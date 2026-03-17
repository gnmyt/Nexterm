What is Apache Guacamole?
=========================

[Apache Guacamole](http://guacamole.apache.org/) is a clientless remote desktop
gateway. It supports standard protocols like VNC and RDP. We call it clientless
because no plugins or client software are required.

Thanks to HTML5, once Guacamole is installed on a server, all you need to
access your desktops is a web browser.

How to use this image
=====================

Using this image will require an existing, running Docker container with the
[guacd image](https://registry.hub.docker.com/u/guacamole/guacd/), and another
Docker container providing either a PostgreSQL, MySQL or SQLServer database.

The name of the database and all associated credentials are specified with
environment variables given when the container is created. All other
configuration information is generated from the Docker links.

Beware that you will need to initialize the database manually. Guacamole will
not automatically create its own tables, but SQL scripts are provided to do
this.

Once the Guacamole image is running, Guacamole will be accessible at
`http://[address of container]:8080/guacamole/`. The instructions below use the
`-p 8080:8080` option to expose this port at the level of the machine hosting
Docker, as well.

Docker Secrets
==============
The string `_FILE` may be appended to some of the environment variables listed
below if you are using MySQL, PostgreSQL or SQLServer authentication. This will
cause the startup script to load the values for those variables from files
within the container.

This is useful for specifying sensitive info, ie. passwords for
the database, in secured files instead of plaintext environment variables. This
is generally used for loading values from [Docker secrets](https://docs.docker.com/engine/swarm/secrets/#read-more-about-docker-secret-commands),
which are stored at `/run/secrets/<secret_name>` within the container.

It is important to note that the startup script is configured such that:

1. You may mix the use of Docker secrets and normal environment variables.
For example, you may wish to use `MYSQL_USER_FILE` and `MYSQL_PASSWORD_FILE`,
but wish to specify the database name with `MYSQL_DATABASE`

2. If both a normal environment variable and its corresponding secret are defined
in the same command line, or section within a [Compose](https://docs.docker.com/compose/) file,
the secret will take precedence. For instance, if both `MYSQL_PASSWORD`
and `MYSQL_PASSWORD_FILE` are given, `MYSQL_PASSWORD_FILE` will be used.

Deploying Guacamole with PostgreSQL authentication
--------------------------------------------------

    docker run --name some-guacamole --link some-guacd:guacd \
        --link some-postgres:postgres        \
        -e POSTGRESQL_DATABASE=guacamole_db  \
        -e POSTGRESQL_USER=guacamole_user    \
        -e POSTGRESQL_PASSWORD=some_password \
        -e POSTGRESQL_DATABASE_FILE=/run/secrets/<secret_name> \
        -e POSTGRESQL_USER_FILE=/run/secrets/<secret_name> \
        -e POSTGRESQL_PASSWORD_FILE=/run/secrets/<secret_name> \
        -d -p 8080:8080 guacamole/guacamole

Linking Guacamole to PostgreSQL requires three environment variables. If any of
these environment variables are omitted, you will receive an error message, and
the image will stop:

1. `POSTGRESQL_DATABASE` - The name of the database to use for Guacamole
   authentication.
2. `POSTGRESQL_USER` - The user that Guacamole will use to connect to PostgreSQL.
3. `POSTGRESQL_PASSWORD` - The password that Guacamole will provide when
   connecting to PostgreSQL as `POSTGRESQL_USER`.
4. `POSTGRESQL_DATABASE_FILE` - The path of the docker secret containing the name
   of database to use for Guacamole authentication.
5. `POSTGRESQL_USER_FILE` - The path of the docker secret containing the name of
   the user that Guacamole will use to connect to PostgreSQL.
6. `POSTGRESQL_PASSWORD_FILE` - The path of the docker secret containing the
   password that Guacamole will provide when connecting to PostgreSQL as
   `POSTGRESQL_USER.

### Initializing the PostgreSQL database

If your database is not already initialized with the Guacamole schema, you will
need to do so prior to using Guacamole. A convenience script for generating the
necessary SQL to do this is included in the Guacamole image.

To generate a SQL script which can be used to initialize a fresh PostgreSQL
database
[as documented in the Guacamole manual](http://guacamole.apache.org/doc/gug/jdbc-auth.html#jdbc-auth-postgresql):

    docker run --rm guacamole/guacamole /opt/guacamole/bin/initdb.sh --postgresql > initdb.sql

Alternatively, you can use the SQL scripts included with the
guacamole-auth-jdbc extension from
[the corresponding release](http://guacamole.apache.org/releases/).

Once this script is generated, you must:

1. Create a database for Guacamole within PostgreSQL, such as `guacamole_db`.
2. Run the script on the newly-created database.
3. Create a user for Guacamole within PostgreSQL with access to the tables and
   sequences of this database, such as `guacamole_user`.

The process for doing this via the `psql` and `createdb` utilities included
with PostgreSQL is documented in
[the Guacamole manual](http://guacamole.apache.org/doc/gug/jdbc-auth.html#jdbc-auth-postgresql).

Deploying Guacamole with MySQL authentication
--------------------------------------------------

    docker run --name some-guacamole --link some-guacd:guacd \
        --link some-mysql:mysql         \
        -e MYSQL_DATABASE=guacamole_db  \
        -e MYSQL_USER=guacamole_user    \
        -e MYSQL_PASSWORD=some_password \
        -e MYSQL_DATABASE_FILE=/run/secrets/<secret_name> \
        -e MYSQL_USER_FILE=/run/secrets/<secret_name> \
        -e MYSQL_PASSWORD_FILE=/run/secrets/<secret_name> \
        -d -p 8080:8080 guacamole/guacamole

Linking Guacamole to MySQL requires three environment variables. If any of
these environment variables are omitted, you will receive an error message, and
the image will stop:

1. `MYSQL_DATABASE` - The name of the database to use for Guacamole
   authentication.
2. `MYSQL_USER` - The user that Guacamole will use to connect to MySQL.
3. `MYSQL_PASSWORD` - The password that Guacamole will provide when connecting
   to MySQL as `MYSQL_USER`.
4. `MYSQL_DATABASE_FILE` - The path of the docker secret containing the name of
   the database to use for Guacamole authentication.
5. `MYSQL_USER_FILE` - The path of the docker secret containing the name of the
   user that Guacamole will use to connect to MySQL.
6. `MYSQL_PASSWORD_FILE` - The path of the docker secret containing the
   password that Guacamole will provide when connecting to MySQL
   as`MYSQL_USER`.

### Initializing the MySQL database

If your database is not already initialized with the Guacamole schema, you will
need to do so prior to using Guacamole. A convenience script for generating the
necessary SQL to do this is included in the Guacamole image.

To generate a SQL script which can be used to initialize a fresh MySQL database
[as documented in the Guacamole manual](http://guacamole.apache.org/doc/gug/jdbc-auth.html#jdbc-auth-mysql):

    docker run --rm guacamole/guacamole /opt/guacamole/bin/initdb.sh --mysql > initdb.sql

Alternatively, you can use the SQL scripts included with
[guacamole-auth-jdbc](https://github.com/apache/guacamole-client/tree/0.9.10-incubating/extensions/guacamole-auth-jdbc/modules/guacamole-auth-jdbc-mysql/schema).

Once this script is generated, you must:

1. Create a database for Guacamole within MySQL, such as `guacamole_db`.
2. Create a user for Guacamole within MySQL with access to this database, such
   as `guacamole_user`.
3. Run the script on the newly-created database.

The process for doing this via the `mysql` utility included with MySQL is
documented in
[the Guacamole manual](http://guacamole.apache.org/doc/gug/jdbc-auth.html#jdbc-auth-mysql).

Deploying Guacamole with SQLServer authentication
--------------------------------------------------

Linking Guacamole to SQLServer requires three environment variables. If any of
these environment variables are omitted, you will receive an error message, and
the image will stop:

1. `SQLSERVER_DATABASE` - The name of the database to use for Guacamole
   authentication.
2. `SQLSERVER_USER` - The user that Guacamole will use to connect to SQLServer.
3. `SQLSERVER_PASSWORD` - The password that Guacamole will provide when
   connecting to SQLServer as `SQLSERVER_USER`.

    docker run --name some-guacamole --link some-guacd:guacd \
        --link some-sqlserver:sqlserver      \
        -e SQLSERVER_DATABASE=guacamole_db  \
        -e SQLSERVER_USER=guacamole_user    \
        -e SQLSERVER_PASSWORD=some_password \
        -d -p 8080:8080 guacamole/guacamole

Alternatively, if you want to store database credentials using Docker secrets,
the following three variables are required and replace the previous three:

1. `SQLSERVER_DATABASE_FILE` - The path of the docker secret containing the name
   of database to use for Guacamole authentication.
2. `SQLSERVER_USER_FILE` - The path of the docker secret containing the name of
   the user that Guacamole will use to connect to SQLServer.
3. `SQLSERVER_PASSWORD_FILE` - The path of the docker secret containing the
   password that Guacamole will provide when connecting to SQLServer as
   `SQLSERVER_USER.

    docker run --name some-guacamole --link some-guacd:guacd \
        --link some-sqlserver:sqlserver      \
        -e SQLSERVER_DATABASE_FILE=/run/secrets/<secret_name> \
        -e SQLSERVER_USER_FILE=/run/secrets/<secret_name> \
        -e SQLSERVER_PASSWORD_FILE=/run/secrets/<secret_name> \
        -d -p 8080:8080 guacamole/guacamole

### Initializing the SQLServer database

If your database is not already initialized with the Guacamole schema, you will
need to do so prior to using Guacamole. A convenience script for generating the
necessary SQL to do this is included in the Guacamole image.

To generate a SQL script which can be used to initialize a fresh SQLServer
database
[as documented in the Guacamole manual](http://guacamole.apache.org/doc/gug/jdbc-auth.html#jdbc-auth-sqlserver):

    docker run --rm guacamole/guacamole /opt/guacamole/bin/initdb.sh --sqlserver > initdb.sql

Alternatively, you can use the SQL scripts included with the
guacamole-auth-jdbc extension from
[the corresponding release](http://guacamole.apache.org/releases/).

Once this script is generated, you must:

1. Create a database for Guacamole within SQLServer, such as `guacamole_db`.
2. Run the script on the newly-created database.
3. Create a user for Guacamole within SQLServer with access to the tables and
   sequences of this database, such as `guacamole_user`.

The process for doing this via the `sqlcmd` utilities included
with SQLServer is documented in
[the Guacamole manual](http://guacamole.apache.org/doc/gug/jdbc-auth.html#jdbc-auth-sqlserver).

Reporting issues
================

Please report any bugs encountered by opening a new issue in
[our JIRA](https://issues.apache.org/jira/browse/GUACAMOLE/).

