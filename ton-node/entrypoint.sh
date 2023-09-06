#!/bin/bash

# init config, if required
if [ ! -f "/data/config.json" ];
then
  echo "Init config..."
  validator-engine \
    -C /global-config.json \
    --db /data \
    --ip $IP_ADDR:$PORT
fi

exec validator-engine \
  --db /data \
  -C /global-config.json \
  --state-ttl 7776000 --archive-ttl 7776000 --block-ttl 7776000

