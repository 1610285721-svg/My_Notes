/*
 * 应用入口文件
 * 创建 Vue 应用 → 安装 Element Plus → 挂载到页面
 */

import './assets/main.css'

import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
