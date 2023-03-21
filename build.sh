#!/usr/bin/env bash
set -ex

DATE=`date +%Y-%m-%d`
#BRANCH=$(git rev-parse --abbrev-ref HEAD)
BRANCH=$1
cd $BRANCH
RELEASECOUNT=$(git rev-list --count --all)
BUILDCOUNT=$(cat /data/distr/buildcounter)
echo "Building $DATE-$BRANCH-$RELEASECOUNT-$BUILDCOUNT"
GIT_SHA=$(git rev-parse HEAD) && cd ..
echo "$GIT_SHA" > $BRANCH/superset/static/assets/git_info
docker build --no-cache -t superset-bi:$DATE-$BRANCH-$RELEASECOUNT-$BUILDCOUNT --build-arg BRANCH=$BRANCH .

docker image tag superset-bi:$DATE-$BRANCH-$RELEASECOUNT-$BUILDCOUNT localhost:5000/superset-bi:$DATE-$BRANCH-$RELEASECOUNT-$BUILDCOUNT
#docker push localhost:5000/superset-bi
docker push localhost:5000/superset-bi:$DATE-$BRANCH-$RELEASECOUNT-$BUILDCOUNT
#docker build -t superset-bi:2019-01-11-develop-25 .

let "BUILDCOUNT += 1"
echo $BUILDCOUNT > /data/distr/buildcounter
