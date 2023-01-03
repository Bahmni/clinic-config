FROM mysql:5.6

RUN apt-get update && \
    apt-get install -y \
    wget \
    unzip \
    gzip
# Download configuration_checksums
RUN wget https://github.com/Bahmni/bahmni-scripts/raw/BAH-2744/demo/db-backups/1.0.0-lite/mysql5.6/configuration_checksums.zip && \
    unzip configuration_checksums.zip && \
    rm configuration_checksums.zip

# Download DB Backup
RUN wget https://github.com/Bahmni/bahmni-scripts/raw/BAH-2744/demo/db-backups/1.0.0-lite/mysql5.6/omrs_dbdump_03012023122840.sql.gz && \
    gunzip -c omrs*.gz > /docker-entrypoint-initdb.d/omrs_db_backup.sql && \
    rm omrs*.gz
