FROM mysql:5.6
COPY package/docker/resources/mysql:5.6/omrs_*.sql /docker-entrypoint-initdb.d
COPY package/docker/resources/mysql:5.6/configuration_checksums /configuration_checksums
