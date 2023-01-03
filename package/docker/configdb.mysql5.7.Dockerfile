FROM mysql:5.7

RUN yum update && \
    yum install -y \
    wget \
    unzip \
    gzip
# Download configuration_checksums
RUN wget https://github.com/Bahmni/bahmni-scripts/raw/master/demo/db-backups/1.0.0-lite/mysql5.7/configuration_checksums.zip && \
    unzip configuration_checksums.zip && \
    rm configuration_checksums.zip

# Download DB Backup
RUN wget https://github.com/Bahmni/bahmni-scripts/raw/master/demo/db-backups/1.0.0-lite/mysql5.7/omrs_dbdump_28122022121837.sql.gz && \
    gunzip -c omrs*.gz > /docker-entrypoint-initdb.d/omrs_db_backup.sql && \
    rm omrs*.gz
