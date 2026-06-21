## RUNNING LOCALLY

### run debugging mode for chrome on port 9222

```shell
sudo /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome_dev_session"
```

### run ui with `npm run start`

```shell
npm run start
```

## RUNNING IN DOCKER

## run docker compose file

docker compose will be building the image and run it on port 4444.

```shell
docker compose up
```

## run debbuning mode in chrom browser and log in

```shell
sudo /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome_dev_session" \
  --remote-allow-origins="*" \
  --no-sandbox
```
