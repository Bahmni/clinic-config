#!/bin/bash
set -e

#Parameters (repository_name,artifact_name,github_pat,target_directory)
repository_name=$1
artifact_name=$2
github_pat=$3
target_directory=$4

if [ $# -ne 4 ]
then
echo "Invalid Arguments. Need repository_name, artifact_name, github_pat,target_directory"
exit 2
fi

curl -s https://api.github.com/repos/BahmniIndiaDistro/$repository_name/actions/artifacts | \
    jq '[.artifacts[] | select (.name == '\"$artifact_name\"')]' | jq -r '.[0] | .archive_download_url' | \
    xargs curl -L -o $artifact_name.zip -H "Authorization: token $github_pat"
unzip -d $target_directory/resources $artifact_name.zip && rm $artifact_name.zip
