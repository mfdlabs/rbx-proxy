FROM node:lts-alpine

ENV LOG_STARTUP_INFO=true
ENV HATE_LAN_ACCESS=true
ENV MFDLABS_ARC_SERVER=
ENV ALLOWED_IPV4_CIDRS=127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
ENV ALLOWED_IPV6_CIDRS=fd00::/8,fe80::/10,ff00::/8,2001:db8::/32,fc00::/7,::1/128
ENV LOG_PERSIST=false
ENV ABORT_CONNECTION_IF_INVALID_IP=true
ENV GA4_MEASUREMENT_ID=
ENV GA4_API_SECRET=
ENV GA4_ENABLE_LOGGING=false
ENV GA4_ENABLE_VALIDATION=true
ENV GA4_DISABLE_IP_LOGGING=false
ENV ENABLE_GA4_CLIENT=false
ENV DISABLE_IPV6=true
ENV INSECURE_PORT=80
ENV SECURE_PORT=443
ENV ENABLE_TLS_SERVER=true
ENV BIND_ADDRESS_IPV4=0.0.0.0
ENV BIND_ADDRESS_IPV6=::
ENV ENABLE_TLSV2=false
ENV SPHYNX_REWRITE_FILE_NAME=sphynx-rewrite.yml
ENV SPHYNX_HARDCODE_FILE_NAME=sphynx-hardcode.yml
ENV SPHYNX_DOMAIN=apis.roblox.com
ENV SPHYNX_REWRITE_BASE_DIRECTORY=
ENV SPHYNX_REWRITE_RELOAD_ON_REQUEST=false
ENV SSL_BASE_DIRECTORY=
ENV SSL_CERTIFICATE_FILE_NAME=mfdlabs-all-authority-roblox-local.crt
ENV SSL_PRIVATE_KEY_FILE_NAME=mfdlabs-all-authority-roblox-local.key
ENV SSL_CERTIFICATE_CHAIN_FILE_NAME=mfdlabs-root-ca-roblox.crt
ENV SSL_KEY_PASSPHRASE=
ENV EXIT_ON_UNCAUGHT_EXCEPTION=true
ENV EXIT_ON_UNHANDLED_REJECTION=true

# make the 'app' folder the current working directory
WORKDIR /app

# copy both 'package.json' and 'package-lock.json' (if available)
COPY package*.json ./

# copy project files and folders to the current working directory (i.e. 'app' folder)
COPY . .

# build app for production
RUN npm run build-full

EXPOSE 80 443
CMD [ "npm", "start" ]