// Minimal stand-in for libctru's <3ds.h> so the randomizer's generator code builds natively for tests.
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
typedef uint8_t u8; typedef uint16_t u16; typedef uint32_t u32; typedef uint64_t u64;
typedef int8_t s8; typedef int16_t s16; typedef int32_t s32; typedef int64_t s64;
typedef s32 Result;
typedef u64 FS_Archive;
typedef u32 Handle;
enum { KEY_A=1, KEY_B=2, KEY_SELECT=4, KEY_START=8, KEY_DRIGHT=16, KEY_DLEFT=32, KEY_DUP=64, KEY_DDOWN=128,
       KEY_R=256, KEY_L=512, KEY_X=1024, KEY_Y=2048, KEY_ZL=1<<14, KEY_ZR=1<<15, KEY_TOUCH=1<<20,
       KEY_CSTICK_RIGHT=1<<24, KEY_CSTICK_LEFT=1<<25, KEY_CSTICK_UP=1<<26, KEY_CSTICK_DOWN=1<<27,
       KEY_CPAD_RIGHT=1<<28, KEY_CPAD_LEFT=1<<29, KEY_CPAD_UP=1<<30, KEY_CPAD_DOWN=1u<<31,
       KEY_UP=KEY_DUP|KEY_CPAD_UP, KEY_DOWN=KEY_DDOWN|KEY_CPAD_DOWN, KEY_LEFT=KEY_DLEFT|KEY_CPAD_LEFT, KEY_RIGHT=KEY_DRIGHT|KEY_CPAD_RIGHT };
static inline void svcOutputDebugString(const char*, int) {}
typedef struct { int type; u32 size; const void* data; } FS_Path;
enum { PATH_ASCII=3, PATH_EMPTY=1, FS_ATTRIBUTE_DIRECTORY=1, FS_OPEN_WRITE=2, FS_OPEN_CREATE=4, FS_OPEN_READ=1, FS_WRITE_FLUSH=1, ARCHIVE_SDMC=9 };
#define R_SUCCEEDED(r) ((r) >= 0)
#define R_FAILED(r) ((r) < 0)
static inline FS_Path fsMakePath(int t, const void* p) { FS_Path x{t, 0, p}; return x; }
static inline Result FSUSER_CreateDirectory(FS_Archive, FS_Path, u32) { return -1; }
static inline Result FSUSER_DeleteFile(FS_Archive, FS_Path) { return -1; }
static inline Result FSUSER_OpenFile(Handle*, FS_Archive, FS_Path, u32, u32) { return -1; }
static inline Result FSUSER_OpenArchive(FS_Archive*, int, FS_Path) { return -1; }
static inline Result FSUSER_OpenDirectory(Handle*, FS_Archive, FS_Path) { return -1; }
static inline Result FSUSER_RenameFile(FS_Archive, FS_Path, FS_Archive, FS_Path) { return -1; }
static inline Result FSUSER_CloseArchive(FS_Archive) { return 0; }
static inline Result FSFILE_Write(Handle, u32*, u64, const void*, u32, u32) { return -1; }
static inline Result FSFILE_Read(Handle, u32*, u64, void*, u32) { return -1; }
static inline Result FSFILE_GetSize(Handle, u64*) { return -1; }
static inline Result FSFILE_Close(Handle) { return 0; }
static inline Result FSDIR_Close(Handle) { return 0; }
static inline Result romfsInit() { return 0; }
static inline Result romfsExit() { return 0; }
