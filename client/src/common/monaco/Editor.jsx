import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import CssWorker from "monaco-editor/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/language/html/html.worker?worker";
import JsonWorker from "monaco-editor/language/json/json.worker?worker";
import TsWorker from "monaco-editor/language/typescript/ts.worker?worker";

const WORKERS = { css: CssWorker, scss: CssWorker, less: CssWorker, html: HtmlWorker, handlebars: HtmlWorker, razor: HtmlWorker, json: JsonWorker, typescript: TsWorker, javascript: TsWorker };
self.MonacoEnvironment = { getWorker: (workerId, label) => new (WORKERS[label] || EditorWorker)() };

loader.config({ monaco });

export default Editor;
