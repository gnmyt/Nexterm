cmake_minimum_required(VERSION 3.16)
project(nexterm-engine C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Debug)
endif()

set(CMAKE_C_FLAGS_DEBUG "-g -O0 -Wall -Wextra")
set(CMAKE_C_FLAGS_RELEASE "-O2 -Wall")

set(GUACAMOLE_SERVER_DIR "${CMAKE_SOURCE_DIR}/../vendor/guacamole-server")
set(GUACAMOLE_DIST_DIR "${GUACAMOLE_SERVER_DIR}/dist")

set(FLATBUFFERS_SCHEMA "${CMAKE_SOURCE_DIR}/../schema/control_plane.fbs")
set(FLATBUFFERS_GENERATED_DIR "${CMAKE_BINARY_DIR}/generated")
file(MAKE_DIRECTORY ${FLATBUFFERS_GENERATED_DIR})

find_program(FLATCC_EXECUTABLE flatcc)

if(FLATCC_EXECUTABLE)
    message(STATUS "Found flatcc: ${FLATCC_EXECUTABLE}")
else()
    include(ExternalProject)
    set(FLATCC_BUILD_DIR ${CMAKE_BINARY_DIR}/flatcc_project-prefix/src/flatcc_project)
    ExternalProject_Add(flatcc_project
        GIT_REPOSITORY https://github.com/dvidelabs/flatcc.git
        GIT_TAG v0.6.1
        CMAKE_ARGS -DFLATCC_TEST=OFF
                   -DFLATCC_REFLECTION=OFF
                   -DFLATCC_INSTALL=OFF
                   -DCMAKE_POLICY_VERSION_MINIMUM=3.5
        INSTALL_COMMAND ""
        BUILD_BYPRODUCTS ${FLATCC_BUILD_DIR}/bin/flatcc
                         ${FLATCC_BUILD_DIR}/lib/libflatccrt.a
    )
    set(FLATCC_EXECUTABLE ${FLATCC_BUILD_DIR}/bin/flatcc)
    set(FLATCC_INCLUDE_DIR ${FLATCC_BUILD_DIR}/../flatcc_project/include)
    set(FLATCC_LIB_DIR ${FLATCC_BUILD_DIR}/lib)
endif()

add_custom_command(
    OUTPUT ${FLATBUFFERS_GENERATED_DIR}/control_plane_builder.h
           ${FLATBUFFERS_GENERATED_DIR}/control_plane_reader.h
           ${FLATBUFFERS_GENERATED_DIR}/control_plane_verifier.h
    COMMAND ${FLATCC_EXECUTABLE} -a -o ${FLATBUFFERS_GENERATED_DIR} ${FLATBUFFERS_SCHEMA}
    DEPENDS ${FLATBUFFERS_SCHEMA}
    COMMENT "Generating FlatBuffers C headers (control_plane)"
)

set(SFTP_PROTOCOL_SCHEMA "${CMAKE_SOURCE_DIR}/../schema/sftp_protocol.fbs")
add_custom_command(
    OUTPUT ${FLATBUFFERS_GENERATED_DIR}/sftp_protocol_builder.h
           ${FLATBUFFERS_GENERATED_DIR}/sftp_protocol_reader.h
           ${FLATBUFFERS_GENERATED_DIR}/sftp_protocol_verifier.h
    COMMAND ${FLATCC_EXECUTABLE} -a -o ${FLATBUFFERS_GENERATED_DIR} ${SFTP_PROTOCOL_SCHEMA}
    DEPENDS ${SFTP_PROTOCOL_SCHEMA}
    COMMENT "Generating FlatBuffers C headers (sftp_protocol)"
)

add_custom_target(flatbuffers_gen
    DEPENDS ${FLATBUFFERS_GENERATED_DIR}/control_plane_builder.h
            ${FLATBUFFERS_GENERATED_DIR}/sftp_protocol_builder.h
)

set(ENGINE_SOURCES
    src/main.c
    src/core/config.c
    src/core/io.c
    src/core/log.c
    src/core/session.c
    src/net/connection.c
    src/net/ssh.c
    src/net/ssh_common.c
    src/net/sftp.c
    src/proto/control_plane.c
)

add_executable(nexterm-engine ${ENGINE_SOURCES})

add_dependencies(nexterm-engine flatbuffers_gen)
if(TARGET flatcc_project)
    add_dependencies(flatbuffers_gen flatcc_project)
endif()

target_include_directories(nexterm-engine PRIVATE
    ${CMAKE_SOURCE_DIR}/src
    ${CMAKE_SOURCE_DIR}/src/core
    ${CMAKE_SOURCE_DIR}/src/net
    ${CMAKE_SOURCE_DIR}/src/proto
)

target_include_directories(nexterm-engine SYSTEM PRIVATE
    ${FLATBUFFERS_GENERATED_DIR}
    ${GUACAMOLE_DIST_DIR}/include
)

if(DEFINED FLATCC_INCLUDE_DIR)
    target_include_directories(nexterm-engine SYSTEM PRIVATE ${FLATCC_INCLUDE_DIR})
endif()

target_link_directories(nexterm-engine PRIVATE
    ${GUACAMOLE_DIST_DIR}/lib
)

find_package(PkgConfig)
if(PkgConfig_FOUND)
    pkg_check_modules(LIBSSH2 libssh2)
endif()

if(NOT LIBSSH2_FOUND)
    find_path(LIBSSH2_INCLUDE_DIRS libssh2.h)
    find_library(LIBSSH2_LIBRARIES ssh2)
    if(LIBSSH2_INCLUDE_DIRS AND LIBSSH2_LIBRARIES)
        set(LIBSSH2_FOUND TRUE)
    endif()
endif()

if(NOT LIBSSH2_FOUND)
    message(FATAL_ERROR "libssh2 not found. Install with: apt install libssh2-1-dev")
endif()

target_include_directories(nexterm-engine PRIVATE ${LIBSSH2_INCLUDE_DIRS})
target_link_directories(nexterm-engine PRIVATE ${LIBSSH2_LIBRARY_DIRS})

target_link_libraries(nexterm-engine PRIVATE
    guac
    ${LIBSSH2_LIBRARIES}
    pthread
    dl
)

if(DEFINED FLATCC_LIB_DIR)
    target_link_directories(nexterm-engine PRIVATE ${FLATCC_LIB_DIR})
    target_link_libraries(nexterm-engine PRIVATE flatccrt)
endif()

set_target_properties(nexterm-engine PROPERTIES
    INSTALL_RPATH "${GUACAMOLE_DIST_DIR}/lib"
    BUILD_RPATH "${GUACAMOLE_DIST_DIR}/lib"
)

install(TARGETS nexterm-engine DESTINATION bin)
