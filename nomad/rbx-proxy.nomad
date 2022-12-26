#  Copyright 2022 Nikita Petko <petko@vmminfra.net>
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# This HashiCorp Nomad job file is used to deploy
# a simple example of rbx-proxy to a Nomad cluster.

# The practises of a side-car traefik load balancer
# are not recommended for production use.
# It is recommended to have a dedicated job for traefik
# so it can be scaled independently of rbx-proxy even
# though the Traefik group has a spread constraint.

# To use this:
# 1. Install Nomad
# 2. Install Vault (not required, but recommended)
# 3. Install Consul (required for Traefik if you do not want to manually configure it)
# 4. Configure Vault to store the traefik users (only required if you want to use the traefik dashboard with basic auth and have Vault installed)
# 5. Replace the datacenter name with your own
# 6. Replace the Consul node name with your own
# 7. Replace the Vault policy name with your own
# 8. Replace the Vault secret path with your own
# 9. Update your $NOMAD_ADDR and $NOMAD_TOKEN environment variables
# 10. Ensure you are in <rbx_proxy_root>/nomad so that the relative paths work
# 11. Run `nomad job run -detach rbx-proxy-test.nomad`

job "rbx-proxy-test" {
  datacenters = ["dc1"]

  # It is recommended to use Vault to store the certificate and key instead of relying on the local filesystem
  vault {
    policies = ["vault_secret_traefik"]
  }

  # Traefik load balancer
  group "traefik" {
    count = 1

    # Acts as the type "system" but for groups
    spread {
      attribute = "${node.datacenter}"
    }

    # Revert to the last stable version if the job fails
    update {
      auto_revert = true
    }

    # Use host networking so that IP addresses are not changed
    network {
      mode = "host"

      # The HTTP port is used for insecure HTTP traffic
      port "http" {
        static = 80
      }

      # The HTTPS port is used for secure HTTPS traffic
      port "https" {
        static = 443
      }

      # The Traefik port is used for the Traefik dashboard
      port "traefik" {
        static = 8080
      }
    }

    # Service checks for the Traefik load balancer
    service {
      name = "traefik"
      port = "http"

      check {
        type     = "tcp"
        interval = "2s"
        timeout  = "2s"
      }

      check {
        type     = "http"
        path     = "/ping"
        interval = "2s"
        timeout  = "2s"
      }
    }

    task "loadbalancer" {
      driver = "docker"

      # Use Traefik v1.7 because v2.0 is finicky, there is a todo to update to v2.0
      config {
        network_mode = "host"
        command      = "traefik"
        args         = ["-c", "/local/traefik.toml"]
        image        = "traefik:v1.7"
        ports        = ["http", "https", "traefik"]
      }

      # Traefik user credentials
      template {
        data = <<EOH
{{ with secret "dev/apps/traefik-users" }}{{ range $k, $v := .Data }}
{{ $k }}:{{ $v }}
{{ end }}{{ end }}
EOH

        destination = "secrets/.htpasswd"
        change_mode = "noop"
      }

      # TLS certificate and key
      template {
        data = file("../ssl/roblox-platform.crt")

        destination = "secrets/traefik.crt"
        change_mode = "noop"
      }

      template {
        data = file("../ssl/roblox-platform.unencrypted.key")

        destination = "secrets/traefik.key"
        change_mode = "noop"
      }

      # Traefik configuration
      template {
        data = <<EOH
logLevel = "INFO"

[traefikLog]
filePath = "/local/traefik.log"

[accessLog]
filePath = "/local/access.log"

[entryPoints]
[entryPoints.http]
address = ":{{ env "NOMAD_PORT_http" }}"

[entryPoints.https]
address = ":{{ env "NOMAD_PORT_https" }}"
[entryPoints.https.tls]
minVersion = "VersionTLS12"
[[entryPoints.https.tls.certificates]]
certFile = "/secrets/traefik.crt"
keyFile = "/secrets/traefik.key"

[entryPoints.traefik]
address = ":{{ env "NOMAD_PORT_traefik" }}"
[entryPoints.traefik.auth]
[entryPoints.traefik.auth.basic]
usersFile = "/secrets/.htpasswd"

[api]
dashboard = true
debug = false

[ping]
entryPoint = "http"

{{ with node "main-node" }}
[consulCatalog]
prefix = "traefik"
exposedByDefault = false
endpoint = "http://{{ .Node.Address }}:8500"
{{ end }}

[metrics]
[metrics.prometheus]
EOH

        destination = "local/traefik.toml"
        change_mode = "noop"
      }

      resources {
        memory = 128
      }
    }
  }

  # RBX Proxy nodes
  group "rbx-proxy" {
    count = 5

    task "server" {
      driver = "docker"

      env {
        BIND_ADDRESS_IPV4  = "0.0.0.0"
        ENABLE_TLS_SERVER  = "false"
        INSECURE_PORT      = "${NOMAD_PORT_http}"
        DISABLE_IPV6       = "true"
        MFDLABS_ARC_SERVER = "true"
      }

      config {
        image = "mfdlabs/rbx-proxy:latest"

        # Set hostnames to the short alloc id
        hostname = "rbx-proxy-node${NOMAD_ALLOC_INDEX}-${NOMAD_SHORT_ALLOC_ID}_${NOMAD_DC}-${NOMAD_REGION}"
      }

      resources {
        network {
          port "http" {}
        }
      }

      service {
        name = "rbx-proxy"
        port = "http"

        tags = [
          "traefik.enable=true",
          "traefik.tags=http",
          "traefik.frontend.entryPoints=http,https",
          "traefik.frontend.passHostHeader=true",
          "traefik.frontend.rule=HostRegexp:rbx-proxy.service.arc-cloud.net,{site:[a-z0-9]+}.{host:(roblox(labs)?|simul(ping|pong|prod))}.{tld:(com|local)},{subdomain:[a-z0-9]+}.{site:[a-z0-9]+}.{host:(roblox(labs)?|simul(ping|pong|prod))}.{tld:(com|local)},{subdomain:[a-z0-9]+}.{type:[a-z0-9]+}.{site:[a-z0-9]+}.{host:(roblox(labs)?|simul(ping|pong|prod))}.{tld:(com|local)}",
          "traefik.backend.loadbalancer.method=wrr",
          "traefik.backend.buffering.retryExpression=IsNetworkError() && Attempts() <= 2"
        ]

        check {
          type     = "http"
          path     = "/_lb/_/health"
          interval = "2s"
          timeout  = "2s"
        }
      }
    }
  }
}