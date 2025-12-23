
------------------------------------------------------------
 About this README
------------------------------------------------------------

This README is intended to provide quick and to-the-point documentation for
technical users intending to compile parts of Apache Guacamole themselves.

Source archives are available from the downloads section of the project website:
 
    http://guacamole.apache.org/

A full manual is available as well:

    http://guacamole.apache.org/doc/gug/


------------------------------------------------------------
 What is guacamole-server?
------------------------------------------------------------

The guacamole-server package is a set of software which forms the basis of the
Guacamole stack. It consists of guacd, libguac, and several protocol support
libraries.

guacd is the Guacamole proxy daemon used by the Guacamole web application and
framework. As JavaScript cannot handle binary protocols (like VNC and remote
desktop) efficiently, a new text-based protocol was developed which would
contain a common superset of the operations needed for efficient remote desktop
access, but would be easy for JavaScript programs to process. guacd is the
proxy which translates between arbitrary protocols and the Guacamole protocol.


------------------------------------------------------------
 Required dependencies
------------------------------------------------------------

All software within guacamole-server is built using the popular GNU Automake,
and thus provides the standard configure script. Before compiling, at least
the following required dependencies must already be installed:

    1) Cairo (http://cairographics.org/)

    2) libjpeg-turbo (http://libjpeg-turbo.virtualgl.org/)
       OR libjpeg (http://www.ijg.org/)

    3) libpng (http://www.libpng.org/pub/png/libpng.html)

    4) OSSP UUID (http://www.ossp.org/pkg/lib/uuid/)


------------------------------------------------------------
 Optional dependencies
------------------------------------------------------------

In addition, the following optional dependencies may be installed in order to
enable optional features of Guacamole. Note that while the various supported
protocols are technically optional, you will no doubt wish to install the 
dependencies of at least ONE supported protocol, as Guacamole would be useless
otherwise.

    RDP:
        * FreeRDP (http://www.freerdp.com/)

    SSH:
        * libssh2 (http://www.libssh2.org/)
        * OpenSSL (https://www.openssl.org/)
        * Pango (http://www.pango.org/)

    Telnet:
        * libtelnet (https://github.com/seanmiddleditch/libtelnet)
        * Pango (http://www.pango.org/)

    VNC:
        * libVNCserver (http://libvnc.github.io/)

    Support for audio within VNC:
        * PulseAudio (http://www.freedesktop.org/wiki/Software/PulseAudio/)

    Support for SFTP file transfer for VNC or RDP:
        * libssh2 (http://www.libssh2.org/)
        * OpenSSL (https://www.openssl.org/)

    Support for WebP image compression:
        * libwebp (https://developers.google.com/speed/webp/)

    "guacenc" video encoding utility:
        * FFmpeg (https://ffmpeg.org/)


------------------------------------------------------------
 Compiling and installing guacd, libguac, etc.
------------------------------------------------------------

All software within guacamole-server is built using the popular GNU Automake,
and thus provides the standard configure script.

1) Run configure

    $ ./configure

    Assuming all dependencies have been installed, this should succeed without
    errors. If you wish to install the init script as well, you need to specify
    the location where your system init scripts are located (typically
    /etc/init.d):

    $ ./configure --with-init-dir=/etc/init.d

    Running configure in this manner will cause the "make install" step to
    install an init script to the specified directory, which you can then
    activate using the service management mechanism provided by your
    distribution).

2) Run make

    $ make

    guacd, libguac, and any available protocol support libraries will now
    compile.

3) Install (as root)

    # make install

    All software that was just built, including documentation, will be
    installed.

    guacd will install to your /usr/local/sbin directory by default. You can
    change the install location by using the --prefix option for configure.


------------------------------------------------------------
 Running guacd 
------------------------------------------------------------

If you installed the init script during compile and install, you should be
able to start guacd through the service management utilities provided by
your distribution (if any) or by running the init script directly (as root):

    # /etc/init.d/guacd start

Root access is needed to write the pidfile /var/run/guacd.pid. You can also run
guacd itself directly without the init script (as any user):

    $ guacd

guacd currently takes several command-line options:

    -b HOST 

        Changes the host or address that guacd listens on.

    -l PORT

        Changes the port that guacd listens on (the default is port 4822).

    -p PIDFILE

        Causes guacd to write the PID of the daemon process to the specified
        file. This is useful for init scripts and is used by the provided init
        script.

    -L LEVEL

        Sets the maximum level at which guacd will log messages to syslog and,
        if running in the foreground, the console.  Legal values are debug,
        info, warning, and error.  The default value is info.

    -f
        Causes guacd to run in the foreground, rather than automatically
        forking into the background. 

Additional information can be found in the guacd man page:

    $ man guacd

------------------------------------------------------------
 Reporting problems
------------------------------------------------------------

Please report any bugs encountered by opening a new issue in the JIRA system
hosted at:
    
    https://issues.apache.org/jira/browse/GUACAMOLE

