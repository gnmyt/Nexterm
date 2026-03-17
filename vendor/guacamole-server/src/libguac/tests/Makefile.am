#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#
# NOTE: Parts of this file (Makefile.am) are automatically transcluded verbatim
# into Makefile.in. Though the build system (GNU Autotools) automatically adds
# its own license boilerplate to the generated Makefile.in, that boilerplate
# does not apply to the transcluded portions of Makefile.am which are licensed
# to you by the ASF under the Apache License, Version 2.0, as described above.
#

AUTOMAKE_OPTIONS = foreign 
ACLOCAL_AMFLAGS = -I m4

#
# Unit tests for libguac
#

check_PROGRAMS = test_libguac
TESTS = $(check_PROGRAMS)

noinst_HEADERS =                     \
    assert-signal.h

test_libguac_SOURCES =               \
    client/buffer_pool.c             \
    client/layer_pool.c              \
    fifo/fifo.c                      \
    flag/flag.c                      \
    id/generate.c                    \
    mem/alloc.c                      \
    mem/ckd_add.c                    \
    mem/ckd_add_or_die.c             \
    mem/ckd_mul.c                    \
    mem/ckd_mul_or_die.c             \
    mem/ckd_sub.c                    \
    mem/ckd_sub_or_die.c             \
    mem/free.c                       \
    mem/realloc.c                    \
    mem/realloc_or_die.c             \
    mem/zalloc.c                     \
    parser/append.c                  \
    parser/read.c                    \
    pool/next_free.c                 \
    protocol/base64_decode.c         \
    protocol/guac_protocol_version.c \
    rect/align.c                     \
    rect/constrain.c                 \
    rect/extend.c                    \
    rect/init.c                      \
    rect/intersects.c                \
    socket/fd_send_instruction.c     \
    socket/nested_send_instruction.c \
    string/strdup.c                  \
    string/strlcat.c                 \
    string/strlcpy.c                 \
    string/strljoin.c                \
    string/strnstr.c                 \
    unicode/charsize.c               \
    unicode/read.c                   \
    unicode/strlen.c                 \
    unicode/write.c

test_libguac_CFLAGS =       \
    -Werror -Wall -pedantic \
    @LIBGUAC_INCLUDE@

test_libguac_LDADD = \
    @CUNIT_LIBS@     \
    @LIBGUAC_LTLIB@

#
# Autogenerate test runner
#

GEN_RUNNER = $(top_srcdir)/util/generate-test-runner.pl
CLEANFILES = _generated_runner.c

_generated_runner.c: $(test_libguac_SOURCES)
	$(AM_V_GEN) $(GEN_RUNNER) $(test_libguac_SOURCES) > $@

nodist_test_libguac_SOURCES = \
    _generated_runner.c

# Use automake's TAP test driver for running any tests
LOG_DRIVER =                \
    env AM_TAP_AWK='$(AWK)' \
    $(SHELL) $(top_srcdir)/build-aux/tap-driver.sh

