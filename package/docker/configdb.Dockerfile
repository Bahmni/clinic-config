FROM mysql:5.7
COPY package/docker/resources/omrs_*.sql /docker-entrypoint-initdb.d
COPY package/docker/resources/configuration_checksums.zip .
RUN yum install -y unzip && \
    unzip configuration_checksums.zip && \
    rm configuration_checksums.zip
