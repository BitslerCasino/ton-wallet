#!/bin/bash

sudo docker-compose \
  --env-file ./docker-compose.env \
  exec ton-console \
  validator-engine-console -k /keys/client -p /keys/server.pub -a ton-node:19900
