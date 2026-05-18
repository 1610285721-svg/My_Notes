# 笔记应用 — 函数接口文档

---

## 一、工具函数

### generateId

| 字段 | 说明 |
|---|---|
| **用途** | 生成一个 UUID v4 格式的随机 ID |
| **参数** | 无 |
| **返回值** | `string` — 如 `'a3f2b1c4-d5e6-7890-abcd-ef1234567890'` |
| **副作用** | 无 |
| **示例** | `const id = generateId()` |
| **注意** | 基于 Math.random()，不保证绝对唯一，但碰撞概率极低 |

---

### now

| 字段 | 说明 |
|---|---|
| **用途** | 获取当前时间的 ISO 格式字符串 |
| **参数** | 无 |
| **返回值** | `string` — 如 `'2026-05-18T12:30:00.000Z'` |
| **副作用** | 无 |
| **示例** | `note.updatedAt = now()` |
| **注意** | 用于笔记的 createdAt / updatedAt 字段 |

---

## 二、存储函数

### loadNotes

| 字段 | 说明 |
|---|---|
| **用途** | 从 localStorage 读取笔记数组 |
| **参数** | 无 |
| **返回值** | `Array` — 笔记对象数组，无数据或解析失败时返回 `[]` |
| **副作用** | 无 |
| **示例** | `notes.value = loadNotes()` |
| **注意** | 内部 try/catch 兜底，数据损坏不会导致应用崩溃 |

---

### saveNotes

| 字段 | 说明 |
|---|---|
| **用途** | 把当前笔记数组写入 localStorage |
| **参数** | 无 |
| **返回值** | 无 |
| **副作用** | 写入 localStorage；空间不足时弹窗报错 |
| **示例** | `saveNotes()` |
| **注意** | 使用 `notes.value` 作为数据源，写入前确保 `notes` 已更新 |

---

### loadPassword

| 字段 | 说明 |
|---|---|
| **用途** | 读取管理员密码 |
| **参数** | 无 |
| **返回值** | `string` — 密码字符串，未设置过默认返回 `'admin'` |
| **副作用** | 无 |
| **示例** | `const pwd = loadPassword()` |
| **注意** | localStorage key 为 `myNotesApp_password` |

---

## 三、编辑模式

### enterEditMode

| 字段 | 说明 |
|---|---|
| **用途** | 弹出密码输入框，验证通过后进入编辑模式 |
| **参数** | 无 |
| **返回值** | 无 |
| **副作用** | 弹窗；密码正确则设 `editMode = true`，写入 localStorage |
| **示例** | 点击"管理"按钮时调用 |
| **注意** | 密码错误只弹提示，不进入；点取消什么都不做 |

---

### exitEditMode

| 字段 | 说明 |
|---|---|
| **用途** | 退出编辑模式，回到阅读模式 |
| **参数** | 无 |
| **返回值** | 无 |
| **副作用** | 设 `editMode = false`，更新 localStorage |
| **示例** | `exitEditMode()` |
| **注意** | 不会丢失编辑中的内容（内容已实时保存） |

---

## 四、模块操作

### toggleModule

| 字段 | 说明 |
|---|---|
| **用途** | 展开/折叠模块的笔记列表 |
| **参数** | `name: string` — 模块名 |
| **返回值** | 无 |
| **副作用** | 修改 `expandedModules`；展开时自动选中该模块第一条笔记 |
| **示例** | `toggleModule('前端笔记')` |
| **注意** | 用 `new Set(set)` 触发 Vue 响应式更新 |

---

### createModule

| 字段 | 说明 |
|---|---|
| **用途** | 弹窗输入模块名，创建新模块（同时创建一篇占位空笔记） |
| **参数** | 无 |
| **返回值** | 无 |
| **副作用** | 弹窗；新增笔记到 `notes`；写入 localStorage；自动展开并选中 |
| **示例** | 点击"+ 新建模块"按钮时调用 |
| **注意** | 模块名不能为空；不能和已有模块重名；空笔记是一篇 title/content 都为空的笔记 |

---

### renameModule

| 字段 | 说明 |
|---|---|
| **用途** | 重命名模块，同时更新该模块下所有笔记的 module 字段 |
| **参数** | `oldName: string` — 原模块名 |
| **返回值** | 无 |
| **副作用** | 弹窗；遍历修改所有相关笔记；同步更新 `expandedModules`；写入 localStorage |
| **示例** | `renameModule('前端笔记')` |
| **注意** | 新名称不能为空、不能和已有模块重名；`''` 空模块名在此函数中被视为 `DEFAULT_MODULE` |

---

### deleteModule

| 字段 | 说明 |
|---|---|
| **用途** | 删除模块及其下所有笔记（不可恢复） |
| **参数** | `name: string` — 要删除的模块名 |
| **返回值** | 无 |
| **副作用** | 弹窗确认；`filter` 过滤掉该模块所有笔记；从 `expandedModules` 移除；当前选中被删则自动跳转；写入 localStorage |
| **示例** | `deleteModule('日记')` |
| **注意** | 不可恢复，弹窗会显示受影响笔记数量；`''` 空模块名被视为 `DEFAULT_MODULE` |

---

## 五、笔记操作

### createNote

| 字段 | 说明 |
|---|---|
| **用途** | 新建一篇空笔记，归入当前模块 |
| **参数** | 无 |
| **返回值** | 无 |
| **副作用** | 新增笔记到 `notes`；自动选中；所在模块没展开则自动展开；编辑器聚焦；写入 localStorage |
| **示例** | 点击"+ 新建笔记"按钮时调用 |
| **注意** | 模块由 `currentModule` 计算属性决定；编辑器聚焦在 `nextTick` 中完成 |

---

### selectNote

| 字段 | 说明 |
|---|---|
| **用途** | 选中一篇笔记，右侧显示其内容 |
| **参数** | `id: string` — 笔记 ID |
| **返回值** | 无 |
| **副作用** | 修改 `selectedNoteId`；笔记所在模块没展开则自动展开；编辑模式下把内容装入编辑器 |
| **示例** | `selectNote('abc-123')` |
| **注意** | 如果已选中同一篇则直接返回；会保存并恢复侧栏滚动位置防止跳动 |

---

### deleteNote

| 字段 | 说明 |
|---|---|
| **用途** | 删除一条笔记（不可恢复） |
| **参数** | `id: string` — 笔记 ID |
| **返回值** | 无 |
| **副作用** | 弹窗确认；`splice` 从数组移除；若删的是当前选中则跳到第一条；写入 localStorage |
| **示例** | `deleteNote('abc-123')` |
| **注意** | 不可恢复；通过 `findIndex` + `splice` 原地删除 |

---

## 六、编辑器函数

### debouncedSave

| 字段 | 说明 |
|---|---|
| **用途** | 防抖保存——连续触发时只在最后一次触发 500ms 后才真正写入 |
| **参数** | 无 |
| **返回值** | 无 |
| **副作用** | 设 `saving = true` 显示"保存中…"；500ms 后调用 `saveNotes()` |
| **示例** | `debouncedSave()` |
| **注意** | 全局变量 `saveTimer` 存储定时器 ID，每次调用先 `clearTimeout` 取消上次 |

---

### onEditorInput

| 字段 | 说明 |
|---|---|
| **用途** | contenteditable 编辑器的 `@input` 事件处理——同步内容到笔记对象并触发保存 |
| **参数** | 无（事件由模板绑定，内部不需要参数） |
| **返回值** | 无 |
| **副作用** | 更新 `selectedNote.content` 和 `selectedNote.updatedAt`；触发 `debouncedSave()` |
| **示例** | 模板：`@input="onEditorInput"` |
| **注意** | 没有选中笔记或编辑器未挂载时直接返回 |

---

### onPaste

| 字段 | 说明 |
|---|---|
| **用途** | 处理粘贴事件——检测剪贴板中的图片并转为 base64 插入 |
| **参数** | `event: ClipboardEvent` — 原生粘贴事件对象 |
| **返回值** | 无 |
| **副作用** | 如有图片，阻止默认粘贴行为，`FileReader` 转 base64 后调用 `insertImageAtCursor`，手动触发 `input` 事件 |
| **示例** | 模板：`@paste="onPaste"` |
| **注意** | 普通文本粘贴走浏览器默认行为不拦截；只处理第一张图片 |

---

### insertImage

| 字段 | 说明 |
|---|---|
| **用途** | 弹出文件选择器，用户选图片后转为 base64 插入编辑器 |
| **参数** | 无 |
| **返回值** | 无 |
| **副作用** | 动态创建 `<input type="file">` 并触发 `click()`；选完图片后调用 `insertImageAtCursor` 和手动触发 `input` 事件 |
| **示例** | 点击"插入图片"按钮时调用 |
| **注意** | 没有选中笔记时弹提示；`accept="image/*"` 限制只能选图片 |

---

### insertImageAtCursor

| 字段 | 说明 |
|---|---|
| **用途** | 在编辑器光标位置插入 `<img>` 元素 |
| **参数** | `base64: string` — 图片的 base64 Data URL |
| **返回值** | 无 |
| **副作用** | 操作 DOM：在光标处插入 `<img>` + `<br>`，光标移到图片后面 |
| **示例** | `insertImageAtCursor('data:image/png;base64,iVBOR...')` |
| **注意** | 使用 `window.getSelection()` API；无光标时追加到编辑器末尾 |

---

## 七、计算属性（Computed）

### selectedNote

| 字段 | 说明 |
|---|---|
| **用途** | 根据 `selectedNoteId` 查找对应的笔记对象 |
| **依赖** | `notes`、`selectedNoteId` |
| **返回** | `Object | undefined` — 笔记对象，没找到返回 `undefined` |
| **使用** | `selectedNote.value?.title` |

---

### readContent

| 字段 | 说明 |
|---|---|
| **用途** | 阅读模式下渲染的 HTML 内容 |
| **依赖** | `selectedNote` |
| **返回** | `string` — HTML 字符串，无内容时返回灰色占位文字 |
| **使用** | 模板：`v-html="readContent"` |

---

### allModuleNames

| 字段 | 说明 |
|---|---|
| **用途** | 提取所有不重复的模块名，按字母排序 |
| **依赖** | `notes` |
| **返回** | `string[]` — 如 `['后端笔记', '前端笔记', '默认分类']` |
| **使用** | `allModuleNames.value.includes(name)` 判断重名 |

---

### moduleGroups

| 字段 | 说明 |
|---|---|
| **用途** | 搜索过滤 + 按模块分组 + 按时间排序 |
| **依赖** | `notes`、`searchQuery` |
| **返回** | `Array<{ name: string, notes: Note[] }>` — 分组并排序后的模块数组 |
| **使用** | 模板：`v-for="group in moduleGroups"` |
| **排序规则** | 模块内笔记按 `updatedAt` 倒序；模块之间按第一条笔记的 `updatedAt` 倒序 |

---

### currentModule

| 字段 | 说明 |
|---|---|
| **用途** | 确定当前所在模块，新建笔记时默认归入此模块 |
| **依赖** | `selectedNote`、`moduleGroups` |
| **返回** | `string` — 模块名 |
| **优先级** | 选中笔记的 module > 第一个分组的 name > `'默认分类'` |

---

## 八、生命周期

### watch（标题监听）

| 字段 | 说明 |
|---|---|
| **用途** | 监听笔记标题变化，自动更新 `updatedAt` 并防抖保存 |
| **监听对象** | `selectedNote.value?.title` |
| **副作用** | 更新 `updatedAt`、触发 `debouncedSave()` |
| **注意** | 只在编辑模式下生效 |

---

### onMounted（页面初始化）

| 字段 | 说明 |
|---|---|
| **用途** | 页面挂载后的初始化——加载数据、兼容旧数据、展开模块、恢复编辑状态 |
| **参数** | 无（回调函数） |
| **副作用** | 从 localStorage 加载笔记；给旧笔记补 `DEFAULT_MODULE`；展开所有模块并选中第一篇；恢复编辑模式状态；注册 `beforeunload` 事件 |
| **执行时机** | Vue 组件 DOM 挂载完成后 |
| **注意** | `beforeunload` 在页面关闭/刷新前取消防抖并立即保存 |

---

## 附录：数据结构

### 笔记对象 Note

```ts
{
  id: string          // UUID v4 格式，如 'a3f2b1c4-d5e6-...'
  title: string       // 笔记标题
  content: string     // HTML 格式的正文内容
  module: string      // 所属模块名，空字符串视为 '默认分类'
  createdAt: string   // ISO 时间字符串
  updatedAt: string   // ISO 时间字符串
}
```

### localStorage 键名

| 键 | 用途 | 默认值 |
|---|---|---|
| `myNotesApp_notes` | 笔记数组 JSON | `[]` |
| `myNotesApp_password` | 管理员密码 | `'admin'` |
| `myNotesApp_editMode` | 编辑模式状态 | `'false'` |

### 常量

| 常量 | 值 |
|---|---|
| `DEFAULT_MODULE` | `'默认分类'` |
| `STORAGE_NOTES` | `'myNotesApp_notes'` |
| `STORAGE_PASSWORD` | `'myNotesApp_password'` |
| `STORAGE_EDITMODE` | `'myNotesApp_editMode'` |
