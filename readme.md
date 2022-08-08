# Roblox Proxy
This is a simple website to proxy Roblox API requests from testing environments to production environments.

Example request hostname:   apis.sitetest1.roblox.com (staging site)
                        ->  apis.roblox.com (production site)

This also support proxying requests to other sites.

# Security
I've tried to stop a lot of loopback attacks, and have settings for determining if the client should have access to your LAN.

You can't go from localhost to localhost, you can't go from your LAN to your LAN.

There may be checks from Gateway to you LAN, which is kimd of a loopback because it's when you loopback to your WAN.

# Usage
This proxy works within the hostname translation ruling. As in you can assign a hostname to this within your hosts file and it will try to resolve and proxy it on it's own side.

# Analytics Warning
If you do happen to setup the environment variables for the GA4 client, every time you initialize the PublicIP within the proxy route it will log the IP address to the GA4 client with the name "PublicIPInitalized".
If you wish for it not to log the IP address, you can set the environment variable "GA4_DISABLE_IP_LOGGING" to "true"

# Docker compose

For docker compose you will have your Docker on a machine that has it's containers use it's true host for NICs.
An example of a system that doesn't do this is Docker for Windows with WSL2. You will need to use Docker for Windows with Hyper-V (TBD) or Docker for Linux.

You will have to manually configure the docker-compose.yml file to have the correct subnet, gateway and NIC for your VLAN.