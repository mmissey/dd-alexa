export SLACK_API_KEY="your key here"
aws s3 cp ./styles/styles.css s3://dd-transcripts/ --profile personal --acl public-read
sls deploy