What is guacd?
==============

[guacd](https://github.com/apache/guacamole-server/) is the native
server-side proxy used by the [Apache Guacamole web
application](http://guacamole.apache.org/).  If you wish to deploy
Guacamole, or an application using the [Guacamole core
APIs](http://guacamole.apache.org/api-documentation), you will need a
copy of guacd running.

How to use this image
=====================

Running guacd for use by the [Guacamole Docker image](https://registry.hub.docker.com/u/guacamole/guacamole/)
-----------------------------------------------------

    docker run --name some-guacd -d guacamole/guacd

guacd will be listening on port 4822, but this port will only be available to
Docker containers that have been explicitly linked to `some-guacd`.

Running guacd for use services by outside Docker
------------------------------------------------

    docker run --name some-guacd -d -p 4822:4822 guacamole/guacd

guacd will be listening on port 4822, and Docker will expose this port on the
same server hosting Docker. Other services, such as an instance of Tomcat
running outside of Docker, will be able to connect to guacd.

Beware of the security ramifications of doing this. There is no authentication
within guacd, so allowing access from untrusted applications is dangerous. If
you need to expose guacd, ensure that you only expose it as absolutely
necessary, and that only specific trusted applications have access. 

Connecting to guacd from an application
---------------------------------------

    docker run --name some-app --link some-guacd:guacd -d application-that-uses-guacd

Reporting issues
================

Please report any bugs encountered by opening a new issue in
[our JIRA](https://issues.apache.org/jira/browse/GUACAMOLE/).

