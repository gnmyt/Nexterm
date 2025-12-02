Static Virtual Channel example
==============================

Guacamole supports use of static virtual channels (SVCs) for transmission of
arbitrary data between the JavaScript client and applications running within
RDP sessions. This example is intended to demonstrate how bidirectional
communication between the Guacamole client and applications within the RDP
server can be accomplished.

Arbitrary SVCs are enabled on RDP connections by specifying their names as the
value of [the `static-channels`
parameter](http://guacamole.apache.org/doc/gug/configuring-guacamole.html#rdp-device-redirection).
Each name is limited to a maximum of 7 characters. Multiple names may be listed
by separating those names with commas.

This example consists of a single file, [`svc-example.c`](svc-example.c), which
leverages the terminal server API exposed by Windows to:

 1. Open a channel called "EXAMPLE"
 2. Wait for blocks of data to be received
 3. Send each received block of data back, unmodified.

Building the example
--------------------

A `Makefile` is provided which uses MinGW to build the `svc-example.exe`
executable, and thus can be used to produce the example application on Linux.
The `Makefile` is not platform-independent, and changes may be needed for
`make` to succeed with your installation of MinGW. If not using MinGW, the C
source itself is standard and should compile with other tools.

To build on Linux using `make`:

```console
$ make
i686-w64-mingw32-gcc svc-example.c -lwtsapi32 \
	-D_WIN32_WINNT=0x600   \
	-DWINVER=0x600 -o svc-example.exe
$
```

You can then copy the resulting `svc-example.exe` to the remote desktop that
you wish to test and run it within a command prompt within the remote desktop
session.

Using the example (and SVCs in general)
---------------------------------------

On the remote desktop server side (within the Windows application leveraging
SVCs to communicate with Guacamole), the following functions are used
specifically for reading/writing to the SVC:

 * [`WTSVirtualChannelOpenEx()`](https://docs.microsoft.com/en-us/windows/win32/api/wtsapi32/nf-wtsapi32-wtsvirtualchannelopenex)
 * [`WTSVirtualChannelRead()`](https://docs.microsoft.com/en-us/windows/win32/api/wtsapi32/nf-wtsapi32-wtsvirtualchannelread)
 * [`WTSVirtualChannelWrite()`](https://docs.microsoft.com/en-us/windows/win32/api/wtsapi32/nf-wtsapi32-wtsvirtualchannelwrite)
 * [`WTSVirtualChannelClose()`](https://docs.microsoft.com/en-us/windows/win32/api/wtsapi32/nf-wtsapi32-wtsvirtualchannelclose)

On the Guacamole side, bidirectional communication is established using:

 * The `static-channels` connection parameter (in the case of the example, this should be set to `EXAMPLE`).
 * An [`onpipe`](http://guacamole.apache.org/doc/guacamole-common-js/Guacamole.Client.html#event:onpipe)
   handler which handles inbound (server-to-client) pipe streams named identically
   to the SVC. The inbound pipe stream will be received upon establishing the RDP
   connection and is used to transmit any data sent along the SVC **from** within
   the remote desktop session. For example:

   ```js
   client.onpipe = function pipeReceived(stream, mimetype, name) {
   
       // Receive output of SVC
       if (name === 'EXAMPLE') {
   
           // Log start of stream
           var reader = new Guacamole.StringReader(stream);
           console.log('pipe: %s: stream begins', name);
   
           // Log each received blob of text
           reader.ontext = function textReceived(text) {
               console.log('pipe: %s: \"%s\"', name, text);
           };
   
           // Log end of stream
           reader.onend = function streamEnded() {
               console.log('pipe: %s: stream ends', name);
           };
   
       }
   
       // All other inbound pipe streams are unsupported
       else
           stream.sendAck('Pipe stream not supported.',
               Guacamole.Status.Code.UNSUPPORTED);
   
   };
   ```

 * Calls to [`createPipeStream()`](http://guacamole.apache.org/doc/guacamole-common-js/Guacamole.Client.html#createPipeStream)
   as needed to establish outbound (client-to-server) pipe streams named
   identically to the SVC. Outbound pipe streams with the same name as the SVC
   will be automatically handled by the Guacamole server, with any received data
   sent along the SVC **to** the remote desktop session. For example:

   ```js
   var example = new Guacamole.StringWriter(client.createPipeStream('text/plain', 'EXAMPLE'));
   example.sendText('This is a test.');
   example.sendEnd();
   ```

   These pipe streams may be created and destroyed as desired. As long as they
   have the same name as the SVC, data sent along the pipe stream will be sent
   along the SVC.

Example output
--------------

If the `static-channels` parameter is set to `EXAMPLE`, the successful creation
of the "EXAMPLE" channel should be logged by guacd when the connection is
established:

```
guacd[12057]: INFO: Created static channel "EXAMPLE"...
guacd[12057]: INFO: Static channel "EXAMPLE" connected.
```

On the client side, the `onpipe` handler should be invoked immediately. If
using the example code shown above, receipt of the pipe stream for the
"EXAMPLE" channel is logged:

```
pipe: EXAMPLE: stream begins
```

Running `svc-example.exe` within a command prompt inside the remote desktop
session, the application logs that the "EXAMPLE" channel has been successfully
opened:

```
Microsoft Windows [Version 10.0.17763.437]
(c) 2018 Microsoft Corporation. All rights reserved.

C:\Users\test>svc-example.exe
SVC "EXAMPLE" open. Reading...
```

Once `createPipeStream()` has been invoked on the Guacamole client side and
using the same name as the SVC (in this case, "EXAMPLE") guacd should log the
inbound half the channel is now connected:

```
guacd[12057]: DEBUG: Inbound half of channel "EXAMPLE" connected.
```

Sending the string `This is a test.` along the client-to-server pipe (as shown
in the example code above) results in `svc-example.exe` logging that it
received those 15 bytes and has resent the same 15 bytes back along the SVC:

```
Received 15 bytes.
Wrote 15 bytes.
```

The data sent from within the remote desktop session is received on the client
side via the server-to-client pipe stream. If using the example code shown
above, the received data is logged:

```
pipe: EXAMPLE: "This is a test."
```

