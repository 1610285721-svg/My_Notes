<!-- ============================================================
  App.vue —— 个人笔记/博客应用

  两种模式：
  1. 阅读模式（默认）—— 打开就能看，左侧模块+列表，右侧正文
  2. 编辑模式（密码进入）—— 点"管理"输密码，出现编辑功能

  技术栈：Vue 3 + Element Plus + 自定义 CSS + localStorage
============================================================ -->

<template>
  <div class="app-container">
    <!-- ==================== 顶部栏 ==================== -->
    <header class="top-bar">
      <h1 class="app-title">📒 我的笔记</h1>
      <!-- 阅读模式：显示"管理"按钮 / 编辑模式：显示"退出管理" -->
      <el-button v-if="!editMode" text type="info" @click="enterEditMode"> 管理 </el-button>
      <template v-else>
        <el-button text type="success" @click="exportNotes"> 导出 </el-button>
        <el-button text type="warning" @click="exitEditMode"> 退出管理 </el-button>
      </template>
    </header>

    <!-- ==================== 主内容区 ==================== -->
    <div class="main-content">
      <!-- ========== 左侧栏 ========== -->
      <aside class="sidebar">
        <!-- 搜索框 -->
        <div class="sidebar-search">
          <el-input v-model="searchQuery" placeholder="搜索笔记…" clearable />
        </div>

        <!-- 模块 + 笔记列表 -->
        <div ref="sidebarRef" class="sidebar-list">
          <!-- 空状态 -->
          <el-empty
            v-if="notes.length === 0"
            :description="editMode ? '还没有笔记，点击下方按钮创建' : '还没有笔记'"
            :image-size="80"
          />
          <!-- 搜索无结果 -->
          <div v-else-if="moduleGroups.length === 0" class="empty-hint">未找到相关笔记</div>
          <!-- 模块分组 -->
          <div v-for="group in moduleGroups" :key="group.name" class="module-group">
            <!-- 模块头部：点击展开/折叠 -->
            <div class="module-header" @click="toggleModule(group.name)">
              <span class="module-arrow" :class="{ expanded: expandedModules.has(group.name) }"
                >▶</span
              >
              <span class="module-name">{{ group.name }}</span>
              <span class="module-count">{{ group.notes.length }}</span>
              <!-- 编辑模式下才有模块操作菜单 -->
              <el-dropdown v-if="editMode" trigger="click" @click.stop>
                <span class="module-menu-btn">
                  <el-icon><MoreFilled /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="renameModule(group.name)">
                      重命名模块
                    </el-dropdown-item>
                    <el-dropdown-item @click="deleteModule(group.name)" divided>
                      删除模块
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <!-- 模块下的笔记列表（展开时显示） -->
            <div v-show="expandedModules.has(group.name)" class="note-list">
              <div
                v-for="note in group.notes"
                :key="note.id"
                class="note-item"
                :class="{ selected: note.id === selectedNoteId }"
                @click="selectNote(note.id)"
              >
                <span class="note-title">{{ note.title || '无标题' }}</span>
                <el-button
                  v-if="editMode"
                  class="note-delete"
                  text
                  size="small"
                  type="danger"
                  @click.stop="deleteNote(note.id)"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 编辑模式下才有底部按钮 -->
        <div v-if="editMode" class="sidebar-footer">
          <el-button class="w-full" @click="createModule">+ 新建模块</el-button>
          <el-button class="w-full" type="primary" @click="createNote">+ 新建笔记</el-button>
        </div>
      </aside>

      <!-- ========== 右侧内容区 ========== -->
      <main class="editor-panel">
        <!-- 没有选中笔记 -->
        <div v-if="!selectedNote" class="empty-editor">选择一篇笔记开始阅读</div>

        <!-- ====== 阅读模式 ====== -->
        <template v-else-if="!editMode">
          <div class="reader-header">
            <h2 class="reader-title">{{ selectedNote.title || '无标题' }}</h2>
          </div>
          <div class="reader-body" v-html="readContent" />
        </template>

        <!-- ====== 编辑模式 ====== -->
        <template v-else>
          <div class="editor-header">
            <el-input
              v-model="selectedNote.title"
              placeholder="笔记标题"
              size="large"
              class="title-input"
            />
          </div>
          <div class="editor-toolbar">
            <el-button size="small" @click="insertImage">
              <el-icon><Picture /></el-icon> 插入图片
            </el-button>
            <span class="save-status">{{ saving ? '保存中…' : '已自动保存' }}</span>
          </div>
          <div
            ref="editorRef"
            class="editor-body"
            contenteditable="true"
            @input="onEditorInput"
            @paste="onPaste"
          />
        </template>
      </main>
    </div>
  </div>
</template>

<!-- ============================================================
  逻辑代码
============================================================ -->
<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Picture, MoreFilled } from '@element-plus/icons-vue'

// ---- 常量 ----
const STORAGE_PASSWORD = 'myNotesApp_password'
const STORAGE_NOTES = 'myNotesApp_notes'
const STORAGE_EDITMODE = 'myNotesApp_editMode'
const DEFAULT_MODULE = '默认分类'

// ---- 状态 ----
const editMode = ref(false)
const notes = ref([])
const selectedNoteId = ref(null)
const searchQuery = ref('')
const saving = ref(false)
const expandedModules = ref(new Set())
const editorRef = ref(null)
const sidebarRef = ref(null)

// ---- 计算属性 ----

/*
 * selectedNote 计算属性
 * 根据 selectedNoteId 从 notes 数组中找到对应的笔记对象
 * 只要 notes 或 selectedNoteId 变了，这个函数会自动重新执行
 * 返回：笔记对象 或 undefined（没找到时）
 */
const selectedNote = computed(() => {
  // find：遍历数组，找到第一个 id 匹配的元素就返回
  return notes.value.find((n) => n.id === selectedNoteId.value)
})

/*
 * readContent 计算属性
 * 阅读模式下，把笔记的 HTML 内容准备好给 v-html 渲染
 * 只要选中的笔记变了，这个函数会自动重新执行
 * 返回：HTML 字符串
 */
const readContent = computed(() => {
  if (!selectedNote.value) return ''
  // 有内容就显示内容，没内容就显示灰色占位文字
  return selectedNote.value.content || '<p style="color:#c0c4cc">空笔记</p>'
})

/*
 * allModuleNames 计算属性
 * 从所有笔记中提取出不重复的模块名，去重后按字母排序
 * 只要 notes 变了，这个函数会自动重新执行
 * 返回：['模块A', '模块B', '默认分类'] 这样的字符串数组
 */
const allModuleNames = computed(() => {
  // Set：自动去重的集合，重复添加同一个值会被忽略
  const names = new Set()
  notes.value.forEach((n) => {
    // 只收集有模块名的，空模块后面统一处理
    if (n.module) names.add(n.module)
  })
  // 如果没有任何模块（全是空模块名），补一个默认分类
  if (names.size === 0) names.add(DEFAULT_MODULE)
  // ...展开 + sort() 字母排序，返回普通数组
  return [...names].sort()
})

/*
 * moduleGroups 计算属性
 * 只要 notes 或 searchQuery 变了，这个函数会自动重新执行
 * 返回结构：[ { name: '模块名', notes: [笔记数组] } ]
 */
const moduleGroups = computed(() => {
  // ====== 第 1 步：拿到搜索关键词 ======
  const keyword = searchQuery.value.trim().toLowerCase()

  // ====== 第 2 步：搜索过滤 ======
  let filtered = notes.value // 默认不过滤，显示全部
  if (keyword) {
    // 搜索框有内容才过滤
    filtered = filtered.filter((n) => {
      // filter：保留符合条件的元素
      return n.title.toLowerCase().includes(keyword) // 标题包含关键词就保留
    })
  }

  // ====== 第 3 步：按模块名分组 ======
  // map 结构：{ '前端笔记': [笔记1, 笔记2], '日记': [笔记3] }
  const map = {}
  for (const n of filtered) {
    const mod = n.module || DEFAULT_MODULE // 没有模块的就归入'默认分类'
    if (!map[mod]) map[mod] = [] // 第一次遇到这个模块 → 建空数组
    map[mod].push(n) // 把笔记塞进去
  }

  // ====== 第 4 步：每个模块内按更新时间倒序 ======
  // b - a 是倒序（新的在前），a - b 是正序（旧的在前）
  for (const arr of Object.values(map)) {
    arr.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }

  // ====== 第 5 步：转成数组 + 模块之间按最新笔记时间倒序 ======
  return Object.entries(map) // 对象 → [['前端', [...]], ['日记', [...]]]
    .map(([name, ns]) => ({ name, notes: ns })) // 转成 [{ name: '前端', notes: [...] }]
    .sort((a, b) => {
      // 模块之间排序
      return new Date(b.notes[0].updatedAt).getTime() - new Date(a.notes[0].updatedAt).getTime()
    })
})

/*
 * currentModule 计算属性
 * 确定"当前所在的模块"是谁，新建笔记时默认归入这个模块
 * 优先级：选中笔记的模块 > 第一个分组的模块 > 默认分类
 * 返回：模块名字符串
 */
const currentModule = computed(() => {
  // 优先用选中笔记的模块名
  if (selectedNote.value?.module) return selectedNote.value.module
  // 没有选中笔记 → 用分组列表中第一个模块
  if (moduleGroups.value.length > 0) return moduleGroups.value[0].name
  // 分组列表也是空的 → 兜底用默认分类
  return DEFAULT_MODULE
})

// ---- 工具函数 ----

/*
 * generateId —— 生成一个 UUID v4 格式的随机 ID
 * 原理：用 Math.random() 生成十六进制随机字符，
 *       替换模板字符串中的 x 和 y 占位符
 *       4 和 8/9/a/b 是 UUID v4 的固定标志位
 * 返回：'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' 格式的字符串
 */
function generateId() {
  // 'xxx...xxx' 是模板，把每个 x/y 替换成随机十六进制字符
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    // Math.random() * 16 → 0~15 的浮点数，| 0 取整（相当于 Math.floor）
    const r = (Math.random() * 16) | 0
    // x → 直接取随机数，y → 保证高位是 10xx（UUID v4 规范）
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/*
 * now —— 获取当前时间的 ISO 格式字符串
 * 用于设置笔记的 createdAt 和 updatedAt 字段
 * 返回：'2026-05-18T12:30:00.000Z' 格式的字符串
 */
function now() {
  return new Date().toISOString()
}

// ---- localStorage ----

/*
 * loadNotes —— 从 localStorage 读取笔记数组
 * 页面初始化时调用，把之前保存的数据还原到内存中
 * 返回：笔记数组，读取失败或没有数据时返回空数组 []
 */
function loadNotes() {
  try {
    // localStorage 只能存字符串，所以用 JSON.parse 还原成对象/数组
    const raw = localStorage.getItem(STORAGE_NOTES)
    return raw ? JSON.parse(raw) : []
  } catch {
    // JSON 解析失败（如数据损坏）→ 返回空数组，不会让应用崩溃
    return []
  }
}

/*
 * saveNotes —— 把当前笔记数组写入 localStorage
 * 每次增删改笔记后调用，实现数据持久化
 */
function saveNotes() {
  try {
    // JSON.stringify 把对象/数组转成字符串存进 localStorage
    localStorage.setItem(STORAGE_NOTES, JSON.stringify(notes.value))
  } catch {
    // localStorage 空间满了就会抛异常，提示用户
    ElMessage.error('保存失败，localStorage 空间不足')
  }
}

/*
 * loadPassword —— 读取管理员密码
 * 从 localStorage 读取，没有设置过就默认 'admin'
 * 返回：密码字符串
 */
function loadPassword() {
  return localStorage.getItem(STORAGE_PASSWORD) || 'admin'
}

// ---- 编辑模式开关 ----

/*
 * enterEditMode —— 点击"管理"按钮 → 弹窗输密码 → 验证通过进入编辑模式
 * .then() 是用户点了"确定"才执行，.catch() 是点了"取消"或关了弹窗
 * 密码正确就把 editMode 设为 true，并写入 localStorage 记住状态
 */
function enterEditMode() {
  // ElMessageBox.prompt：弹出带输入框的对话框
  ElMessageBox.prompt('请输入管理员密码', '进入管理', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputType: 'password', // 输入框类型设为密码（输入时显示圆点）
  })
    .then(({ value }) => {
      // 用户输入的值和 localStorage 存的密码比较
      if (value === loadPassword()) {
        editMode.value = true // ← 切换为编辑模式（页面显示编辑功能）
        localStorage.setItem(STORAGE_EDITMODE, 'true') // 记住状态，刷新页面也不丢失
        ElMessage.success('已进入编辑模式')
      } else {
        ElMessage.error('密码错误')
      }
    })
    .catch(() => {}) // 用户点取消或关闭弹窗 → 什么都不做
}

/*
 * exitEditMode —— 点击"退出管理"按钮 → 回到阅读模式
 * 把 editMode 设为 false，更新 localStorage
 */
function exitEditMode() {
  editMode.value = false
  localStorage.setItem(STORAGE_EDITMODE, 'false')
  ElMessage.info('已退出编辑模式')
}

/*
 * exportNotes —— 把当前所有笔记导出为 notes.json 文件下载
 * 下载的文件放到项目 public/ 目录下，git push 后别人就能看到
 */
function exportNotes() {
  // JSON.stringify 第三个参数 2 表示缩进 2 格，方便人阅读
  const json = JSON.stringify(notes.value, null, 2)
  // 创建一个 Blob（二进制数据），类型是 JSON
  const blob = new Blob([json], { type: 'application/json' })
  // 创建一个临时下载链接
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'notes.json'    // 下载的文件名
  a.click()                     // 触发下载
  URL.revokeObjectURL(url)      // 释放内存
  ElMessage.success('notes.json 已下载，放到项目 public/ 目录下，git push 即可发布')
}

// ---- 模块操作 ----

/*
 * toggleModule —— 点击模块头部 → 展开/折叠笔记列表
 * 展开时自动选中该模块的第一条笔记
 * Vue 的响应式需要 Set 引用变化才能触发更新，
 * 所以最后用 new Set(set) 创建一个新 Set 赋值回去
 */
function toggleModule(name) {
  const set = expandedModules.value
  if (set.has(name)) {
    // 已展开 → 折叠（从 Set 中移除）
    set.delete(name)
  } else {
    // 已折叠 → 展开（加入 Set），并自动选中第一条笔记
    set.add(name)
    const group = moduleGroups.value.find((g) => g.name === name)
    if (group && group.notes.length > 0) selectNote(group.notes[0].id)
  }
  // 新建一个 Set 对象赋值，触发 Vue 响应式更新
  expandedModules.value = new Set(set)
}

/*
 * createModule —— 新建模块（同时创建一篇空笔记作为模块的占位笔记）
 * 步骤：弹窗输入模块名 → 校验重名 → 创建空笔记归属该模块 → 保存
 * 命名规范：模块名不能为空、不能和已有模块重名
 */
function createModule() {
  ElMessageBox.prompt('请输入新模块名称', '新建模块', {
    confirmButtonText: '创建',
    cancelButtonText: '取消',
  })
    .then(({ value }) => {
      const name = value?.trim() // 去掉首尾空格
      if (!name) {
        ElMessage.warning('模块名不能为空')
        return
      }
      // 检查是否重名
      if (allModuleNames.value.includes(name)) {
        ElMessage.warning('模块名已存在')
        return
      }
      // 创建一篇空笔记，module 字段设为新模块名
      const note = {
        id: generateId(),
        title: '',
        content: '',
        module: name,
        createdAt: now(),
        updatedAt: now(),
      }
      notes.value.push(note) // ← 加入笔记数组（触发响应式更新）
      saveNotes() // 写入 localStorage
      // 自动展开新模块
      expandedModules.value.add(name)
      expandedModules.value = new Set(expandedModules.value)
      selectedNoteId.value = note.id // 自动选中这篇新笔记
      ElMessage.success(`模块「${name}」已创建`)
    })
    .catch(() => {}) // 用户取消 → 什么都不做
}

/*
 * renameModule —— 重命名模块
 * 步骤：弹窗输入新名称 → 校验有效性 → 遍历所有笔记，把 module 字段更新为新名
 * 注意：空模块名的笔记（module 为空字符串）会被视为 DEFAULT_MODULE
 */
function renameModule(oldName) {
  ElMessageBox.prompt('请输入新名称', '重命名模块「' + oldName + '」', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  })
    .then(({ value }) => {
      const newName = value?.trim()
      // 没输入或名字没变 → 直接返回
      if (!newName || newName === oldName) return
      // 检查新名字是否和已有模块重名
      if (allModuleNames.value.includes(newName)) {
        ElMessage.warning('模块名已存在')
        return
      }
      // 遍历所有笔记，原模块名匹配的都改成新名字
      notes.value.forEach((n) => {
        // (n.module || DEFAULT_MODULE)：空模块名视为默认分类
        if ((n.module || DEFAULT_MODULE) === oldName) n.module = newName
      })
      // 更新展开状态中的模块名
      const set = expandedModules.value
      if (set.has(oldName)) {
        set.delete(oldName) // 删掉旧名
        set.add(newName) // 加上新名
        expandedModules.value = new Set(set) // 触发响应式
      }
      saveNotes()
      ElMessage.success('已重命名')
    })
    .catch(() => {})
}

/*
 * deleteModule —— 删除模块及其下的所有笔记（不可恢复）
 * 步骤：统计受影响笔记数 → 弹窗确认 → filter 过滤掉该模块的笔记 → 保存
 * 如果当前选中的笔记被删了，自动跳转到第一条笔记
 */
function deleteModule(name) {
  // 先数一下该模块下有多少篇笔记
  const count = notes.value.filter((n) => (n.module || DEFAULT_MODULE) === name).length
  // ElMessageBox.confirm：弹出确认对话框（带警告样式）
  ElMessageBox.confirm(
    `确定要删除模块「${name}」及其下的 ${count} 篇笔记吗？此操作不可恢复。`,
    '删除模块',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
  )
    .then(() => {
      // filter：保留模块名不等于要删除模块的笔记，其余全部移除
      notes.value = notes.value.filter((n) => (n.module || DEFAULT_MODULE) !== name)
      // 如果当前选中的笔记也被删了 → 自动跳到第一条
      if (!notes.value.find((n) => n.id === selectedNoteId.value)) {
        selectedNoteId.value = notes.value.length > 0 ? notes.value[0].id : null
        // nextTick：等 Vue 更新完 DOM 后再设置编辑器内容
        nextTick(() => {
          if (editorRef.value && selectedNote.value)
            editorRef.value.innerHTML = selectedNote.value.content
        })
      }
      // 从展开列表里移除该模块
      const set = expandedModules.value
      set.delete(name)
      expandedModules.value = new Set(set)
      saveNotes()
      ElMessage.success('已删除')
    })
    .catch(() => {}) // 用户点取消 → 什么都不做
}

// ---- 笔记 CRUD ----

/*
 * createNote —— 新建一篇空笔记
 * 模块默认为 currentModule（当前所在模块）
 * 创建后自动选中、展开所在模块、编辑器聚焦
 */
function createNote() {
  const note = {
    id: generateId(),
    title: '',
    content: '',
    module: currentModule.value, // 默认归入当前模块
    createdAt: now(),
    updatedAt: now(),
  }
  notes.value.push(note) // ← 加入笔记数组
  selectedNoteId.value = note.id // 自动选中
  // 如果所在模块还没展开，自动展开
  const set = expandedModules.value
  if (!set.has(note.module)) {
    set.add(note.module)
    expandedModules.value = new Set(set)
  }
  saveNotes()
  // nextTick：等 Vue 渲染出编辑器 DOM 后再聚焦
  nextTick(() => editorRef.value?.focus())
}

/*
 * selectNote —— 点击侧栏笔记 → 右边显示内容
 * 如果已经是选中的笔记，直接返回不重复操作
 * 如果笔记所在模块没展开，自动展开它
 * 保存并恢复侧栏滚动位置，防止模块展开时列表跳动
 */
function selectNote(id) {
  // 已经是当前选中的笔记 → 不做任何操作
  if (selectedNoteId.value === id) return
  const note = notes.value.find((n) => n.id === id)
  selectedNoteId.value = id
  // 记住当前滚动位置（后面要恢复，防止跳动）
  const scrollTop = sidebarRef.value?.scrollTop ?? 0
  if (note) {
    const mod = note.module || DEFAULT_MODULE // 空模块名视为默认分类
    // 如果所在模块折叠了，自动展开
    const set = expandedModules.value
    if (!set.has(mod)) {
      set.add(mod)
      expandedModules.value = new Set(set)
    }
  }
  // nextTick：等模块展开/折叠的 DOM 更新完成后再操作
  nextTick(() => {
    // 编辑模式下把内容装进编辑器
    if (editorRef.value && note && editMode.value) editorRef.value.innerHTML = note.content
    // 恢复滚动位置，抵消因模块展开导致的位移
    if (sidebarRef.value) sidebarRef.value.scrollTop = scrollTop
  })
}

/*
 * deleteNote —— 删除一条笔记（不可恢复）
 * 步骤：弹窗确认 → findIndex 找到位置 → splice 删掉 → 保存
 * 如果要删的就是当前选中的，自动跳转到第一条笔记
 */
function deleteNote(id) {
  ElMessageBox.confirm('确定要删除这条笔记吗？此操作不可恢复。', '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      // findIndex：找到索引 → splice：从数组中移除
      const idx = notes.value.findIndex((n) => n.id === id)
      if (idx !== -1) notes.value.splice(idx, 1) // splice(索引, 1) = 删1个
      // 删的是当前选中的笔记 → 跳到第一条（或清空）
      if (selectedNoteId.value === id) {
        selectedNoteId.value = notes.value.length > 0 ? notes.value[0].id : null
        nextTick(() => {
          if (editorRef.value && selectedNote.value && editMode.value)
            editorRef.value.innerHTML = selectedNote.value.content
        })
      }
      saveNotes()
      ElMessage.success('已删除')
    })
    .catch(() => {}) // 用户点取消 → 什么都不做
}

// ---- 编辑器 ----
let saveTimer = null // 防抖定时器 ID，用于取消上一次还没执行的保存

/*
 * debouncedSave —— 防抖保存
 * 用户连续打字时，每次输入都会重置 500ms 倒计时
 * 只有 500ms 内没再输入，才真正执行 saveNotes()
 * 目的：避免频繁写 localStorage，提升性能
 */
function debouncedSave() {
  saving.value = true // 显示"保存中…"
  if (saveTimer) clearTimeout(saveTimer) // 取消上次还没执行的定时器
  saveTimer = setTimeout(() => {
    saveNotes() // 500ms 后真正保存
    saving.value = false // 显示"已自动保存"
  }, 500)
}

/*
 * onEditorInput —— 编辑器内容变化时触发
 * 把 contenteditable 的 HTML 内容同步到笔记对象的 content 字段
 * 更新 updatedAt 时间戳，触发防抖保存
 */
function onEditorInput() {
  if (!selectedNote.value || !editorRef.value) return
  // innerHTML：contenteditable 元素的内容（带 HTML 标签）
  selectedNote.value.content = editorRef.value.innerHTML
  selectedNote.value.updatedAt = now() // 更新修改时间
  debouncedSave() // 触发防抖保存
}

/*
 * onPaste —— 粘贴事件处理
 * 检查剪贴板里有没有图片，有的话转成 base64 插入编辑器
 * 普通文本粘贴由浏览器默认行为处理（contenteditable 自带）
 * 用 FileReader 把图片 Blob 转成 base64 字符串，存进 localStorage
 */
function onPaste(event) {
  if (!selectedNote.value) return
  // clipboardData.items：剪贴板的所有内容项
  const items = event.clipboardData?.items
  if (!items) return
  for (const item of items) {
    // type 以 'image/' 开头说明是图片
    if (item.type.startsWith('image/')) {
      event.preventDefault() // 阻止浏览器默认粘贴（防止插入 blob URL）
      const file = item.getAsFile() // 把剪贴板的图片数据读成 File 对象
      if (!file) continue
      const reader = new FileReader()
      // onload：文件读取完成后触发，e.target.result 是 base64 字符串
      reader.onload = (e) => {
        insertImageAtCursor(e.target?.result) // 插入 <img> 到光标位置
        // 手动触发 input 事件，让 onEditorInput 同步内容和保存
        editorRef.value?.dispatchEvent(new Event('input', { bubbles: true }))
      }
      // readAsDataURL：把文件读成 base64 格式的 Data URL
      reader.readAsDataURL(file)
      break // 只处理第一张图片
    }
  }
}

/*
 * insertImage —— 点击"插入图片"按钮 → 弹出文件选择器
 * 原理：动态创建一个隐藏的 <input type="file">，用 click() 触发文件选择
 * 用户选完图片后，用 FileReader 转成 base64，插入到编辑器光标位置
 */
function insertImage() {
  if (!selectedNote.value) {
    ElMessage.warning('请先选择或创建一个笔记')
    return
  }
  // 动态创建文件选择器
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*' // 只接受图片类型的文件
  // onchange：用户选择文件后触发
  input.onchange = () => {
    const file = input.files?.[0] // 取第一张选中的图片
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      insertImageAtCursor(e.target?.result) // 插入 <img> 到光标位置
      editorRef.value?.dispatchEvent(new Event('input', { bubbles: true }))
    }
    reader.readAsDataURL(file) // 转成 base64
  }
  input.click() // 弹出文件选择对话框
}

/*
 * insertImageAtCursor —— 在编辑器光标位置插入一张图片
 * 核心：通过 Selection API 获取光标所在的 Range，把 <img> 插入到那个位置
 * 插入后光标移到图片后面，方便继续打字
 * 如果没有光标（首次加载），则追加到编辑器末尾
 */
function insertImageAtCursor(base64) {
  const editor = editorRef.value
  if (!editor) return
  editor.focus() // 聚焦编辑器
  const sel = window.getSelection() // 获取当前选区/光标
  if (!sel) return
  // 创建 <img> 元素并设置样式
  const img = document.createElement('img')
  img.src = base64 // base64 作为图片源
  img.style.maxWidth = '100%'
  img.style.height = 'auto'
  // rangeCount > 0：有光标/选区存在
  if (sel.rangeCount > 0) {
    const range = sel.getRangeAt(0) // 拿到光标所在的 Range
    range.deleteContents() // 如果有选中文本，先删除
    range.insertNode(img) // 在光标位置插入 <img>
    // 图片后面加个 <br> 换行，方便继续输入
    const br = document.createElement('br')
    img.parentNode?.insertBefore(br, img.nextSibling)
    range.setStartAfter(br) // 把光标移到 <br> 后面
    range.collapse(true) // 折叠选区（确保只是光标，不是选中）
    sel.removeAllRanges()
    sel.addRange(range) // 应用新光标位置
  } else {
    // 没有任何光标 → 直接追加到编辑器末尾
    editor.appendChild(img)
    editor.appendChild(document.createElement('br'))
  }
}

// ---- 监听标题变化自动保存 ----

/*
 * watch —— 监听标题输入框的变化
 * 因为 v-model 是绑定到 selectedNote.title 的，
 * 这里监听它，一旦变化就更新 updatedAt 并触发防抖保存
 * 第一个参数 () => selectedNote.value?.title 是"监听谁"
 * 第二个参数是"变了之后做什么"
 */
watch(
  // 监听函数：返回要监听的值的引用
  () => selectedNote.value?.title,
  () => {
    // 只在编辑模式下自动保存，阅读模式不触发
    if (selectedNote.value && editMode.value) {
      selectedNote.value.updatedAt = now() // 更新修改时间
      debouncedSave() // 触发防抖保存
    }
  },
)

// ---- 页面初始化 ----

/*
 * onMounted —— Vue 组件挂载到 DOM 后执行（整个应用的入口）
 * 做的事情：
 *   1. 从 localStorage 加载笔记数据
 *   2. 给没有 module 的老笔记补上默认分类
 *   3. 有笔记就展开所有模块、选中第一篇
 *   4. 恢复编辑模式状态（上次退出时是不是在编辑模式）
 *   5. 注册页面关闭事件，关闭前做最后一次保存
 */
/*
 * 页面初始化（应用启动时执行一次）
 * 加载顺序：先读 notes.json（部署后有数据）→ 读 localStorage（本地编辑的数据）→ 合并
 * 编辑过的笔记以 localStorage 为准，没编辑过的以 notes.json 为准
 */
onMounted(async () => {

  // ====== 1. 尝试从服务器加载 notes.json ======
  // 部署后 /notes.json 在 public 目录下，别人访问时能读到
  // 本地开发时如果没放 notes.json，fetch 会失败，走 catch
  let remoteNotes = []
  try {
    const res = await fetch('notes.json')
    if (res.ok) remoteNotes = await res.json()
  } catch {
    // notes.json 不存在（本地开发时），忽略，后面用 localStorage
  }

  // ====== 2. 加载本地 localStorage 中的笔记 ======
  const localNotes = loadNotes()

  // ====== 3. 合并数据：remote 是基础，local 里更新过的笔记覆盖 remote ======
  // 这样你本地编辑后刷新也能看到最新内容，同时部署的 notes.json 也有数据
  if (remoteNotes.length > 0 && localNotes.length === 0) {
    // 有远程数据但没有本地数据（第一次访问部署版）→ 直接用远程数据
    notes.value = remoteNotes
    saveNotes()  // 同步到 localStorage
  } else if (remoteNotes.length > 0 && localNotes.length > 0) {
    // 两边都有 → 以本地为准（本地是你编辑过的），但新增的远程笔记也保留
    const localIds = new Set(localNotes.map((n) => n.id))
    const merged = [...localNotes]
    // 把远程有但本地没有的笔记加进来
    for (const n of remoteNotes) {
      if (!localIds.has(n.id)) merged.push(n)
    }
    notes.value = merged
    saveNotes()
  } else {
    // 没有远程数据 → 纯本地模式
    notes.value = localNotes
  }

  // ====== 4. 兼容旧数据：没有 module 字段的笔记补上默认分类 ======
  let needSave = false
  notes.value.forEach((n) => {
    if (!n.module) {
      n.module = DEFAULT_MODULE
      needSave = true
    }
  })
  if (needSave) saveNotes()

  // ====== 5. 有笔记 → 初始化侧栏 + 选中 ======
  if (notes.value.length > 0) {
    const set = new Set()
    notes.value.forEach((n) => set.add(n.module || DEFAULT_MODULE))
    expandedModules.value = set
    selectedNoteId.value = notes.value[0].id
    if (editMode.value) {
      nextTick(() => {
        if (editorRef.value && selectedNote.value)
          editorRef.value.innerHTML = selectedNote.value.content
      })
    }
  }

  // ====== 6. 恢复编辑模式状态 ======
  editMode.value = localStorage.getItem(STORAGE_EDITMODE) === 'true'

  // ====== 5. 页面关闭/刷新前做最后一次保存 ======
  // beforeunload：在页面卸载前触发，赶在关闭前把数据存好
  window.addEventListener('beforeunload', () => {
    if (saveTimer) {
      clearTimeout(saveTimer) // 取消防抖定时器
      saveNotes() // 立即保存当前数据
    }
  })
})
</script>

<!-- ============================================================
  样式 —— 全部使用简单易懂的 class 名称，不依赖 Tailwind
============================================================ -->
<style>
/* ============================================================
   全局重置
   ============================================================ */
html,
body,
#app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #333;
}

/* ============================================================
   根容器 —— 撑满整个窗口
   ============================================================ */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
}

/* ============================================================
   顶部栏
   ============================================================ */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

/* ============================================================
   主内容区（左侧栏 + 右侧内容）
   ============================================================ */
.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ============================================================
   左侧栏（宽度 280px）
   ============================================================ */
.sidebar {
  width: 280px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  background: #f9fafb;
  flex-shrink: 0;
}

.sidebar-search {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-hint {
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  margin-top: 40px;
}

/* ---- 模块分组 ---- */
.module-group {
  margin-bottom: 2px;
}

.module-header {
  display: flex;
  align-items: center;
  padding: 8px 8px;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.module-header:hover {
  background: #e5e7eb;
}

.module-arrow {
  font-size: 12px;
  color: #9ca3af;
  margin-right: 6px;
  transition: transform 0.2s;
}
.module-arrow.expanded {
  transform: rotate(90deg);
}

.module-name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.module-count {
  font-size: 12px;
  color: #9ca3af;
  margin-right: 4px;
}

.module-menu-btn {
  color: #9ca3af;
  padding: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.module-header:hover .module-menu-btn {
  opacity: 1;
}
.module-menu-btn:hover {
  color: #4b5563;
}

/* ---- 笔记列表 ---- */
.note-list {
  margin-left: 12px;
}

.note-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 2px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.15s;
}
.note-item:hover {
  background: #e5e7eb;
}
.note-item.selected {
  background: #dbeafe;
  border-left-color: #3b82f6;
}

.note-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-delete {
  opacity: 0;
  flex-shrink: 0;
}
.note-item:hover .note-delete {
  opacity: 1;
}

/* ---- 侧栏底部按钮 ---- */
.sidebar-footer {
  padding: 12px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ============================================================
   右侧内容面板
   ============================================================ */
.editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-editor {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d1d5db;
  font-size: 18px;
}

/* ---- 阅读模式 ---- */
.reader-header {
  padding: 20px 24px 16px;
}
.reader-title {
  font-size: 28px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  line-height: 1.4;
}
.reader-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 24px;
  line-height: 1.8;
  word-wrap: break-word;
}
.reader-body img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 8px 0;
  border-radius: 4px;
}

/* ---- 编辑模式 ---- */
.editor-header {
  padding: 16px 24px 12px;
  border-bottom: 1px solid #e5e7eb;
}

/* 标题输入框去默认边框 */
.title-input .el-input__wrapper {
  box-shadow: none !important;
  padding: 0 !important;
}
.title-input .el-input__inner {
  font-size: 24px !important;
  font-weight: 600 !important;
  color: #1f2937 !important;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 24px;
  border-bottom: 1px solid #f3f4f6;
}
.save-status {
  font-size: 12px;
  color: #9ca3af;
  margin-left: auto;
}

.editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  outline: none;
  line-height: 1.8;
  word-wrap: break-word;
}
.editor-body img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 8px 0;
  border-radius: 4px;
}
/* 编辑器为空时占位文字 */
.editor-body:empty::before {
  content: '开始输入你的笔记内容…';
  color: #c0c4cc;
}

/* ============================================================
   通用工具类
   ============================================================ */
.w-full {
  width: 100%;
}
</style>
