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
# Unit tests for libguac_common
#

check_PROGRAMS = test_common
TESTS = $(check_PROGRAMS)

noinst_HEADERS =               \
    iconv/convert-test-data.h

test_common_SOURCES =          \
    iconv/convert.c            \
    iconv/convert-test-data.c  \
    rect/clip_and_split.c      \
    rect/constrain.c           \
    rect/expand_to_grid.c      \
    rect/extend.c              \
    rect/init.c                \
    rect/intersects.c          \
    string/count_occurrences.c \
    string/split.c

test_common_CFLAGS =        \
    -Werror -Wall -pedantic \
    @COMMON_INCLUDE@        \
    @LIBGUAC_INCLUDE@

test_common_LDADD =  \
    @COMMON_LTLIB@   \
    @CUNIT_LIBS@     \
    @LIBGUAC_LTLIB@

#
# Autogenerate test runner
#

GEN_RUNNER = $(top_srcdir)/util/generate-test-runner.pl
CLEANFILES = _generated_runner.c

_generated_runner.c: $(test_common_SOURCES)
	$(AM_V_GEN) $(GEN_RUNNER) $(test_common_SOURCES) > $@

nodist_test_common_SOURCES = \
    _generated_runner.c

# Use automake's TAP test driver for running any tests
LOG_DRIVER =                \
    env AM_TAP_AWK='$(AWK)' \
    $(SHELL) $(top_srcdir)/build-aux/tap-driver.sh

