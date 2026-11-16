#include <jni.h>
#include <stdlib.h>

#include "nexterm_vt.h"

#define FN(name) Java_dev_gnm_nexterm_terminal_Vt_##name
#define VT ((NxtVt*)(intptr_t)h)

static jbyteArray take(JNIEnv* env, NxtVt* vt, size_t (*fn)(NxtVt*, uint8_t*, size_t)) {
  size_t len = fn(vt, NULL, 0);
  jbyteArray arr = (*env)->NewByteArray(env, (jsize)len);
  if (!arr || len == 0) return arr;
  jbyte* p = (*env)->GetByteArrayElements(env, arr, NULL);
  fn(vt, (uint8_t*)p, len);
  (*env)->ReleaseByteArrayElements(env, arr, p, 0);
  return arr;
}

JNIEXPORT jlong JNICALL FN(create)(JNIEnv* env, jobject self, jint cols, jint rows, jint scrollback) {
  return (jlong)(intptr_t)nxt_new((uint16_t)cols, (uint16_t)rows, (uint32_t)scrollback);
}

JNIEXPORT void JNICALL FN(free)(JNIEnv* env, jobject self, jlong h) { nxt_free(VT); }

JNIEXPORT jint JNICALL FN(write)(JNIEnv* env, jobject self, jlong h, jbyteArray data, jint len) {
  jbyte* p = (*env)->GetPrimitiveArrayCritical(env, data, NULL);
  int events = nxt_write(VT, (const uint8_t*)p, (size_t)len);
  (*env)->ReleasePrimitiveArrayCritical(env, data, p, JNI_ABORT);
  return events;
}

JNIEXPORT void JNICALL FN(resize)(JNIEnv* env, jobject self, jlong h, jint cols, jint rows, jint cw, jint ch) {
  nxt_resize(VT, (uint16_t)cols, (uint16_t)rows, (uint32_t)cw, (uint32_t)ch);
}

JNIEXPORT void JNICALL FN(setColors)(JNIEnv* env, jobject self, jlong h, jint fg, jint bg, jint cursor, jintArray palette) {
  jint* p = (*env)->GetIntArrayElements(env, palette, NULL);
  nxt_set_colors(VT, (uint32_t)fg, (uint32_t)bg, (uint32_t)cursor, (const uint32_t*)p);
  (*env)->ReleaseIntArrayElements(env, palette, p, JNI_ABORT);
}

JNIEXPORT jbyteArray JNICALL FN(takeOutput)(JNIEnv* env, jobject self, jlong h) { return take(env, VT, nxt_take_output); }

JNIEXPORT jboolean JNICALL FN(snapshot)(JNIEnv* env, jobject self, jlong h, jintArray cps, jintArray fg, jintArray bg,
                                        jintArray flags, jintArray extra, jintArray info) {
  jintArray arrays[6] = {cps, fg, bg, flags, extra, info};
  jint* p[6];
  for (int i = 0; i < 6; i++) p[i] = (*env)->GetPrimitiveArrayCritical(env, arrays[i], NULL);
  int ok = nxt_snapshot(VT, p[0], p[1], p[2], p[3], (*env)->GetArrayLength(env, cps), p[4],
                        (*env)->GetArrayLength(env, extra), p[5]);
  for (int i = 5; i >= 0; i--) (*env)->ReleasePrimitiveArrayCritical(env, arrays[i], p[i], 0);
  return (jboolean)ok;
}

JNIEXPORT void JNICALL FN(scroll)(JNIEnv* env, jobject self, jlong h, jint kind, jlong delta) { nxt_scroll(VT, kind, delta); }

JNIEXPORT jboolean JNICALL FN(mode)(JNIEnv* env, jobject self, jlong h, jint mode, jboolean ansi) {
  return (jboolean)nxt_mode(VT, (uint16_t)mode, ansi);
}

JNIEXPORT jboolean JNICALL FN(key)(JNIEnv* env, jobject self, jlong h, jint key, jint mods, jbyteArray utf8, jint unshifted) {
  jbyte* p = utf8 ? (*env)->GetByteArrayElements(env, utf8, NULL) : NULL;
  int ok = nxt_key(VT, key, mods, (const uint8_t*)p, p ? (size_t)(*env)->GetArrayLength(env, utf8) : 0, (uint32_t)unshifted);
  if (p) (*env)->ReleaseByteArrayElements(env, utf8, p, JNI_ABORT);
  return (jboolean)ok;
}

JNIEXPORT jboolean JNICALL FN(mouse)(JNIEnv* env, jobject self, jlong h, jint action, jint button, jint mods, jfloat x,
                                     jfloat y, jint sw, jint sh, jint cw, jint ch) {
  return (jboolean)nxt_mouse(VT, action, button, mods, x, y, (uint32_t)sw, (uint32_t)sh, (uint32_t)cw, (uint32_t)ch);
}

static void with_bytes(JNIEnv* env, jlong h, jbyteArray data, void (*fn)(NxtVt*, const uint8_t*, size_t)) {
  jbyte* p = (*env)->GetByteArrayElements(env, data, NULL);
  fn(VT, (const uint8_t*)p, (size_t)(*env)->GetArrayLength(env, data));
  (*env)->ReleaseByteArrayElements(env, data, p, JNI_ABORT);
}

JNIEXPORT void JNICALL FN(text)(JNIEnv* env, jobject self, jlong h, jbyteArray data) { with_bytes(env, h, data, nxt_text); }

JNIEXPORT void JNICALL FN(paste)(JNIEnv* env, jobject self, jlong h, jbyteArray data) { with_bytes(env, h, data, nxt_paste); }

JNIEXPORT jboolean JNICALL FN(selectWords)(JNIEnv* env, jobject self, jlong h, jint x1, jint y1, jint x2, jint y2) {
  return (jboolean)nxt_select_words(VT, (uint16_t)x1, (uint16_t)y1, (uint16_t)x2, (uint16_t)y2);
}

JNIEXPORT void JNICALL FN(clearSelection)(JNIEnv* env, jobject self, jlong h) { nxt_select_clear(VT); }

JNIEXPORT jbyteArray JNICALL FN(selectionText)(JNIEnv* env, jobject self, jlong h) {
  if (nxt_selection_text(VT) < 0) return NULL;
  return take(env, VT, nxt_take_string);
}
