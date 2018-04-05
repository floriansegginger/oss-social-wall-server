#!/bin/sh
while true; do 
cd /home/ubuntu/social-wall-server
node /home/ubuntu/social-wall-server/app.js 2>&1 >> /var/log/pmw.log  
sleep 1
done
