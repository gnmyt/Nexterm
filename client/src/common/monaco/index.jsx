import { lazy, Suspense } from "react";

const Editor = lazy(() => import("./Editor.jsx"));

export const MonacoEditor = (props) => <Suspense fallback={null}><Editor {...props} /></Suspense>;

export default MonacoEditor;
