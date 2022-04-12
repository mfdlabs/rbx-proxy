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