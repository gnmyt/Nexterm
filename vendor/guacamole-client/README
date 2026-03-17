
------------------------------------------------------------
 About this README
------------------------------------------------------------

This README is intended to provide quick and to-the-point documentation for
technical users intending to compile parts of Apache Guacamole themselves.

Source archives and pre-built .war files are available from the downloads
section of the project website:
 
    http://guacamole.apache.org/

A full manual is available as well:

    http://guacamole.apache.org/doc/gug/


------------------------------------------------------------
 What is guacamole-client?
------------------------------------------------------------

guacamole-client is the superproject containing all Maven-based projects that
make Apache Guacamole, an HTML5 web application that provides access to your
desktop using remote desktop protocols.

guacamole-client is used to build the subprojects that make up Guacamole, and
to provide a common central repository. Each project contained here is
completely independent of guacamole-client and can be built separately, though
the others may have to be built first. If all projects are built using
guacamole-client, Maven will take care of the proper build order.


------------------------------------------------------------
 Compiling and installing Apache Guacamole
------------------------------------------------------------

Apache Guacamole is built using Maven. Building Guacamole compiles all classes
and packages them into a deployable .war file. This .war file can be installed
and deployed under servlet containers like Apache Tomcat or Jetty.

1) Run mvn package

    $ mvn package

    Maven will download any needed dependencies for building the .jar file.
    Once all dependencies have been downloaded, the .war file will be
    created in the guacamole/target/ subdirectory of the current directory.

2) Copy the .war file as directed in the instructions provided with
   your servlet container.

   Apache Tomcat, Jetty, and other servlet containers have specific and
   varying locations that .war files must be placed for the web
   application to be deployed.

   You will likely need to do this as root.


------------------------------------------------------------
 Reporting problems
------------------------------------------------------------

Please report any bugs encountered by opening a new issue in the JIRA system
hosted at:
    
    https://issues.apache.org/jira/browse/GUACAMOLE/

