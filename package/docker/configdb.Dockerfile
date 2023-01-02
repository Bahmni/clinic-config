FROM mysql:5.7
COPY package/docker/resources/omrs_*.sql /docker-entrypoint-initdb.d
COPY package/docker/resources/configuration_checksums /configuration_checksums
