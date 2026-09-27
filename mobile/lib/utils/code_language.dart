import 'package:re_editor/re_editor.dart';
import 'package:re_highlight/languages/bash.dart';
import 'package:re_highlight/languages/c.dart';
import 'package:re_highlight/languages/cpp.dart';
import 'package:re_highlight/languages/csharp.dart';
import 'package:re_highlight/languages/css.dart';
import 'package:re_highlight/languages/dart.dart';
import 'package:re_highlight/languages/dockerfile.dart';
import 'package:re_highlight/languages/go.dart';
import 'package:re_highlight/languages/graphql.dart';
import 'package:re_highlight/languages/ini.dart';
import 'package:re_highlight/languages/java.dart';
import 'package:re_highlight/languages/javascript.dart';
import 'package:re_highlight/languages/json.dart';
import 'package:re_highlight/languages/kotlin.dart';
import 'package:re_highlight/languages/less.dart';
import 'package:re_highlight/languages/makefile.dart';
import 'package:re_highlight/languages/markdown.dart';
import 'package:re_highlight/languages/nginx.dart';
import 'package:re_highlight/languages/php.dart';
import 'package:re_highlight/languages/properties.dart';
import 'package:re_highlight/languages/python.dart';
import 'package:re_highlight/languages/ruby.dart';
import 'package:re_highlight/languages/rust.dart';
import 'package:re_highlight/languages/scss.dart';
import 'package:re_highlight/languages/sql.dart';
import 'package:re_highlight/languages/swift.dart';
import 'package:re_highlight/languages/typescript.dart';
import 'package:re_highlight/languages/xml.dart';
import 'package:re_highlight/languages/yaml.dart';

class CodeLanguage {
  static String languageIdForPath(String remotePath) {
    final lower = remotePath.toLowerCase();
    final slash = lower.lastIndexOf('/');
    final basename = slash >= 0 ? lower.substring(slash + 1) : lower;
    if (basename == 'dockerfile') return 'dockerfile';
    if (basename == 'makefile') return 'makefile';
    if (basename == '.env') return 'ini';
    if (basename == 'nginx.conf') return 'nginx';
    final dot = basename.lastIndexOf('.');
    final ext = dot > 0 ? basename.substring(dot + 1) : '';
    switch (ext) {
      case 'js':
      case 'mjs':
      case 'cjs':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
      case 'mts':
      case 'cts':
        return 'typescript';
      case 'json':
        return 'json';
      case 'html':
      case 'htm':
      case 'vue':
      case 'svg':
        return 'xml';
      case 'xml':
        return 'xml';
      case 'css':
        return 'css';
      case 'scss':
      case 'sass':
        return 'scss';
      case 'less':
        return 'less';
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'yml':
      case 'yaml':
        return 'yaml';
      case 'sh':
      case 'bash':
      case 'zsh':
        return 'bash';
      case 'py':
        return 'python';
      case 'go':
        return 'go';
      case 'java':
        return 'java';
      case 'c':
      case 'h':
        return 'c';
      case 'cpp':
      case 'cc':
      case 'cxx':
      case 'hpp':
      case 'hxx':
        return 'cpp';
      case 'cs':
        return 'csharp';
      case 'php':
        return 'php';
      case 'rb':
        return 'ruby';
      case 'rs':
        return 'rust';
      case 'swift':
        return 'swift';
      case 'kt':
      case 'kts':
        return 'kotlin';
      case 'sql':
        return 'sql';
      case 'gql':
      case 'graphql':
        return 'graphql';
      case 'toml':
      case 'ini':
      case 'conf':
      case 'cfg':
      case 'env':
        return 'ini';
      case 'properties':
        return 'properties';
      case 'dart':
        return 'dart';
      case 'nginx':
      case 'nginxconf':
        return 'nginx';
      case 'mk':
      case 'mak':
        return 'makefile';
      default:
        return '';
    }
  }

  static Map<String, CodeHighlightThemeMode> highlightLanguagesForPath(
      String remotePath) {
    final id = languageIdForPath(remotePath);
    switch (id) {
      case 'javascript':
        return {'javascript': CodeHighlightThemeMode(mode: langJavascript)};
      case 'typescript':
        return {'typescript': CodeHighlightThemeMode(mode: langTypescript)};
      case 'json':
        return {'json': CodeHighlightThemeMode(mode: langJson)};
      case 'xml':
        return {'xml': CodeHighlightThemeMode(mode: langXml)};
      case 'css':
        return {'css': CodeHighlightThemeMode(mode: langCss)};
      case 'scss':
        return {'scss': CodeHighlightThemeMode(mode: langScss)};
      case 'less':
        return {'less': CodeHighlightThemeMode(mode: langLess)};
      case 'markdown':
        return {'markdown': CodeHighlightThemeMode(mode: langMarkdown)};
      case 'yaml':
        return {'yaml': CodeHighlightThemeMode(mode: langYaml)};
      case 'bash':
        return {'bash': CodeHighlightThemeMode(mode: langBash)};
      case 'python':
        return {'python': CodeHighlightThemeMode(mode: langPython)};
      case 'go':
        return {'go': CodeHighlightThemeMode(mode: langGo)};
      case 'java':
        return {'java': CodeHighlightThemeMode(mode: langJava)};
      case 'c':
        return {'c': CodeHighlightThemeMode(mode: langC)};
      case 'cpp':
        return {'cpp': CodeHighlightThemeMode(mode: langCpp)};
      case 'csharp':
        return {'csharp': CodeHighlightThemeMode(mode: langCsharp)};
      case 'php':
        return {'php': CodeHighlightThemeMode(mode: langPhp)};
      case 'ruby':
        return {'ruby': CodeHighlightThemeMode(mode: langRuby)};
      case 'rust':
        return {'rust': CodeHighlightThemeMode(mode: langRust)};
      case 'swift':
        return {'swift': CodeHighlightThemeMode(mode: langSwift)};
      case 'kotlin':
        return {'kotlin': CodeHighlightThemeMode(mode: langKotlin)};
      case 'sql':
        return {'sql': CodeHighlightThemeMode(mode: langSql)};
      case 'graphql':
        return {'graphql': CodeHighlightThemeMode(mode: langGraphql)};
      case 'ini':
        return {'ini': CodeHighlightThemeMode(mode: langIni)};
      case 'properties':
        return {
          'properties': CodeHighlightThemeMode(mode: langProperties)
        };
      case 'dart':
        return {'dart': CodeHighlightThemeMode(mode: langDart)};
      case 'dockerfile':
        return {
          'dockerfile': CodeHighlightThemeMode(mode: langDockerfile)
        };
      case 'makefile':
        return {'makefile': CodeHighlightThemeMode(mode: langMakefile)};
      case 'nginx':
        return {'nginx': CodeHighlightThemeMode(mode: langNginx)};
      default:
        return {};
    }
  }
}
