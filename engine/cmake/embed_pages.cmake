string(REPLACE "|" ";" SOURCES "${SOURCES}")

set(generated "/* Generated from engine/webview/pages by embed_pages.cmake. Do not edit. */\n")
string(APPEND generated "#pragma once\n")

foreach(source IN LISTS SOURCES)
    get_filename_component(name "${source}" NAME)
    string(MAKE_C_IDENTIFIER "${name}" symbol)
    string(TOUPPER "${symbol}" symbol)

    file(READ "${source}" content)
    string(REPLACE "\\" "\\\\" content "${content}")
    string(REPLACE "\"" "\\\"" content "${content}")
    string(REPLACE "\n" "\\n\"\n    \"" content "${content}")

    string(APPEND generated "\nstatic const char WEBVIEW_${symbol}[] =\n    \"${content}\";\n")
endforeach()

file(WRITE "${OUTPUT}" "${generated}")
