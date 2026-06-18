const {
  DEFAULT_CATEGORIES,
  getUserCategories,
  saveUserCategories,
  normalizeCategory,
  normalizeTags,
  migrateCategoryToOther,
  OTHER_CATEGORY
} = require('../../utils/categories')

const DEFAULT_PROOF_TYPES = ['现场照片', '工牌证件', '合影', '聊天记录', '合同', '付款记录', '证书', '邮件']
const PROOF_TYPE_STORAGE_KEY = 'customProofTypes'
const COMPRESS_QUALITY = 80
const MAX_FILE_COUNT = 9
const COMMUNITY_ACTIVITY_TEMPLATE = {
  title: '社区环保活动记录',
  category: '活动 / 项目',
  location: '城市公园',
  role: '参与者 / 组织协助',
  description: '记录活动过程、个人参与内容和后续可复盘的材料。'
}
const COMMUNITY_ACTIVITY_EXAMPLE_FILES = [
  {
    id: 'community_activity_group',
    path: '../../images/onboarding/example-community-group.jpg',
    previewPath: '/images/onboarding/example-community-group.jpg',
    type: '合影照片',
    name: '合影照片'
  },
  {
    id: 'community_activity_poster',
    path: '../../images/onboarding/example-community-poster.jpg',
    previewPath: '/images/onboarding/example-community-poster.jpg',
    type: '活动海报',
    name: '活动海报'
  },
  {
    id: 'community_activity_material',
    path: '../../images/onboarding/example-community-material.jpg',
    previewPath: '/images/onboarding/example-community-material.jpg',
    type: '签到记录',
    name: '签到记录'
  }
]
const COMMUNITY_ACTIVITY_PROOF_TYPES = COMMUNITY_ACTIVITY_EXAMPLE_FILES.map(item => item.type)
const COMMUNITY_ACTIVITY_EXAMPLE_PATHS = COMMUNITY_ACTIVITY_EXAMPLE_FILES.map(item => item.path)

Page({
    data: {
      isEdit: false,
      editId: '',
  
      tagInput: '',
  
      categories: DEFAULT_CATEGORIES,
  
      proofTypes: DEFAULT_PROOF_TYPES,
  
      currentProofType: DEFAULT_PROOF_TYPES[0],
  
      files: [],
  
      form: {
        title: '',
        date: '',
        endDate: '',
        location: '',
        category: DEFAULT_CATEGORIES[0],
        role: '',
        description: '',
        tags: [],
        privacy: 'normal'
      }
    },
  
    onLoad(options) {
      this.initManagedLists()

      if (options.id) {
        this.loadEditRecord(options.id)
        return
      }

      if (options.template === 'communityActivity') {
        this.applyCommunityActivityTemplate()
      }
    },

    onShow() {
      this.refreshCategories()
    },

    normalizePrivacy(value) {
      const privateValues = ['private', 'encrypted', 'export_confirm', 'locked']
      return privateValues.includes(value) ? 'private' : 'normal'
    },
  
    initManagedLists() {
      const cachedProofTypes = wx.getStorageSync(PROOF_TYPE_STORAGE_KEY)
      const categories = getUserCategories()
      const proofTypes = Array.isArray(cachedProofTypes) && cachedProofTypes.length ? cachedProofTypes : DEFAULT_PROOF_TYPES

      this.setData({
        categories,
        proofTypes,
        'form.category': categories.includes(this.data.form.category) ? this.data.form.category : (categories[0] || OTHER_CATEGORY),
        currentProofType: proofTypes[0] || ''
      })
    },

    refreshCategories() {
      const categories = getUserCategories()
      const currentCategory = normalizeCategory(this.data.form.category, categories)
      this.setData({ categories, 'form.category': currentCategory })
    },

    applyCommunityActivityTemplate() {
      const template = COMMUNITY_ACTIVITY_TEMPLATE
      const categories = getUserCategories()

      if (!categories.includes(template.category)) {
        saveUserCategories([...categories, template.category])
      }

      const cachedProofTypes = wx.getStorageSync(PROOF_TYPE_STORAGE_KEY)
      const proofTypes = Array.isArray(cachedProofTypes) && cachedProofTypes.length ? cachedProofTypes : this.data.proofTypes
      const nextProofTypes = Array.from(new Set([...proofTypes, ...COMMUNITY_ACTIVITY_PROOF_TYPES]))
      wx.setStorageSync(PROOF_TYPE_STORAGE_KEY, nextProofTypes)

      const nextCategories = getUserCategories()

      this.setData({
        categories: nextCategories,
        proofTypes: nextProofTypes,
        currentProofType: COMMUNITY_ACTIVITY_EXAMPLE_FILES[0].type,
        files: COMMUNITY_ACTIVITY_EXAMPLE_FILES.map(item => ({ ...item })),
        form: {
          ...this.data.form,
          title: template.title,
          category: template.category,
          location: template.location,
          role: template.role,
          description: template.description
        }
      })
    },
  
    loadEditRecord(id) {
      const categories = getUserCategories()
      const records = wx.getStorageSync('records') || []
      const record = (Array.isArray(records) ? records : []).find(item => item.id === id)
  
      if (!record) {
        wx.showToast({ title: '记录不存在', icon: 'none' })
        setTimeout(() => { wx.navigateBack() }, 800)
        return
      }
  
      this.setData({
        isEdit: true,
        editId: id,
        files: this.normalizeStoredFiles(record.files || []),
        tagInput: normalizeTags(record.tags).join('，'),
        form: {
          title: record.title || '',
          date: record.date || '',
          endDate: record.endDate || '',
          location: record.location || '',
          category: normalizeCategory(record.category, categories),
          role: record.role || '',
          description: record.description || '',
          tags: normalizeTags(record.tags),
          privacy: this.normalizePrivacy(record.privacy)
        }
      })
    },
  
    goBack() { wx.navigateBack() },
  
    onInput(e) {
      const field = e.currentTarget.dataset.field
      const value = e.detail.value
      this.setData({ [`form.${field}`]: value })
    },
  
    onDateChange(e) { this.setData({ 'form.date': e.detail.value }) },

    onEndDateChange(e) { this.setData({ 'form.endDate': e.detail.value }) },
  
    selectCategory(e) { this.setData({ 'form.category': e.currentTarget.dataset.value }) },
  
    selectProofType(e) { this.setData({ currentProofType: e.currentTarget.dataset.value }) },

    addCategory() {
      wx.showModal({
        title: '新增分类',
        editable: true,
        placeholderText: '请输入分类名称',
        success: res => {
          if (!res.confirm) return
          const value = (res.content || '').trim()
          if (!value) {
            wx.showToast({ title: '分类不能为空', icon: 'none' })
            return
          }
          if (this.data.categories.includes(value)) {
            wx.showToast({ title: '分类已存在', icon: 'none' })
            return
          }
          const categories = [...this.data.categories, value]
          saveUserCategories(categories)
          this.setData({ categories: getUserCategories(), 'form.category': value })
        }
      })
    },

    deleteCategory(e) {
      const value = e.currentTarget.dataset.value
      if (!value) return

      if (value === OTHER_CATEGORY) {
        wx.showToast({ title: '其他分类不可删除', icon: 'none' })
        return
      }

      wx.showModal({
        title: '删除分类',
        content: '删除该分类后，原属于此分类的记录将自动归入“其他”，是否继续？',
        confirmText: '删除',
        confirmColor: '#B24A3B',
        success: res => {
          if (!res.confirm) return
          migrateCategoryToOther(value)
          const categories = getUserCategories()
          const nextCategory = this.data.form.category === value ? OTHER_CATEGORY : normalizeCategory(this.data.form.category, categories)
          this.setData({ categories, 'form.category': nextCategory })
          wx.showToast({ title: '分类已删除', icon: 'success' })
        }
      })
    },

    addProofType() {
      wx.showModal({
        title: '新增材料类型',
        editable: true,
        placeholderText: '请输入材料类型名称',
        success: res => {
          if (!res.confirm) return
          const value = (res.content || '').trim()
          if (!value) {
            wx.showToast({ title: '材料类型不能为空', icon: 'none' })
            return
          }
          if (this.data.proofTypes.includes(value)) {
            wx.showToast({ title: '材料类型已存在', icon: 'none' })
            return
          }
          const proofTypes = [...this.data.proofTypes, value]
          wx.setStorageSync(PROOF_TYPE_STORAGE_KEY, proofTypes)
          this.setData({ proofTypes, currentProofType: this.data.currentProofType || value })
        }
      })
    },

    deleteProofType(e) {
      const value = e.currentTarget.dataset.value
      wx.showModal({
        title: '删除材料类型',
        content: `确定要删除“${value}”吗？已保存材料上的类型文字不会受影响。`,
        confirmText: '删除',
        confirmColor: '#B24A3B',
        success: res => {
          if (!res.confirm) return
          const proofTypes = this.data.proofTypes.filter(item => item !== value)
          const nextProofType = this.data.currentProofType === value ? (proofTypes[0] || '') : this.data.currentProofType
          wx.setStorageSync(PROOF_TYPE_STORAGE_KEY, proofTypes)
          this.setData({ proofTypes, currentProofType: nextProofType })
        }
      })
    },
  
    onTagInput(e) {
      const value = e.detail.value
      const tags = value.split(/[,，]/).map(item => item.trim()).filter(Boolean)
      this.setData({ tagInput: value, 'form.tags': tags })
    },
  
    onPrivacyChange(e) {
      this.setData({ 'form.privacy': this.normalizePrivacy(e.detail.value) })
    },

    isCloudFilePath(path) {
      return typeof path === 'string' && path.indexOf('cloud://') === 0
    },

    isBundledExampleFilePath(path) {
      return COMMUNITY_ACTIVITY_EXAMPLE_PATHS.includes(path)
    },

    getImagePath(file) {
      if (!file) return ''
      return file.tempFilePath || file.path || ''
    },

    getFileExt(filePath) {
      const cleanPath = String(filePath || '').split('?')[0]
      const match = cleanPath.match(/\.([a-zA-Z0-9]+)$/)
      return match ? match[1].toLowerCase() : 'jpg'
    },

    compressImage(filePath) {
      return new Promise(resolve => {
        if (!filePath) {
          resolve('')
          return
        }

        wx.compressImage({
          src: filePath,
          quality: COMPRESS_QUALITY,
          success: res => resolve(res.tempFilePath || filePath),
          fail: err => {
            console.warn('图片压缩失败，使用原图继续上传：', err)
            resolve(filePath)
          }
        })
      })
    },

    async compressImageBeforeUpload(filePath) {
      return this.compressImage(filePath)
    },

    async uploadOneImage(file, index) {
      const sourcePath = this.getImagePath(file)

      if (!sourcePath) {
        throw new Error(`第${index + 1}张图片路径无效`)
      }

      const uploadPath = await this.compressImageBeforeUpload(sourcePath)
      const ext = this.getFileExt(uploadPath || sourcePath)
      const cloudPath = `proof-images/${Date.now()}_${index}_${Math.random().toString(36).slice(2)}.${ext}`
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: uploadPath || sourcePath })

      if (!uploadRes || !uploadRes.fileID) {
        throw new Error(`第${index + 1}张图片上传后没有返回 fileID`)
      }

      return {
        id: Date.now() + '_' + Math.random().toString(36).slice(2),
        path: uploadRes.fileID,
        previewPath: uploadPath || sourcePath,
        type: this.data.currentProofType,
        name: this.data.currentProofType
      }
    },
  
    async chooseImage() {
      if (!this.data.currentProofType) {
        wx.showToast({ title: '请先添加材料类型', icon: 'none' })
        return
      }

      const remainingCount = Math.max(1, MAX_FILE_COUNT - ((this.data.files || []).length))

      wx.chooseMedia({
        count: remainingCount,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: async res => {
          const selectedFiles = Array.isArray(res.tempFiles) ? res.tempFiles : []

          if (!selectedFiles.length) return

          wx.showLoading({ title: '上传图片中...', mask: true })

          const newFiles = []
          const failedIndexes = []

          for (let i = 0; i < selectedFiles.length; i++) {
            try {
              const uploadedFile = await this.uploadOneImage(selectedFiles[i], i)
              newFiles.push(uploadedFile)
            } catch (err) {
              console.error(`第${i + 1}张图片上传失败：`, err)
              failedIndexes.push(i + 1)
            }
          }

          wx.hideLoading()

          if (newFiles.length) {
            this.setData({ files: [...(this.data.files || []), ...newFiles] })
          }

          if (failedIndexes.length) {
            wx.showToast({
              title: `第${failedIndexes.join('、')}张上传失败`,
              icon: 'none',
              duration: 2500
            })
            return
          }

          wx.showToast({ title: '上传成功', icon: 'success' })
        },
        fail: err => {
          console.error('选择图片失败：', err)
          wx.showToast({ title: '未选择图片', icon: 'none' })
        }
      })
    },
  
    previewImage(e) {
      const index = e.currentTarget.dataset.index
      const urls = this.data.files
        .map(item => item && (item.previewPath || item.path))
        .filter(Boolean)
      if (!urls.length || !urls[index]) return
      wx.previewImage({ current: urls[index], urls })
    },
  
    deleteFile(e) {
      const index = e.currentTarget.dataset.index
      const files = [...this.data.files]
      files.splice(index, 1)
      this.setData({ files })
    },
  
    normalizeStoredFiles(files) {
      return (Array.isArray(files) ? files : [])
        .map(file => {
          if (!file) return null
          const path = file.path || file.fileID || file.url || ''
          if (!this.isCloudFilePath(path) && !this.isBundledExampleFilePath(path)) return null
          return {
            id: file.id || Date.now() + '_' + Math.random().toString(36).slice(2),
            path,
            previewPath: file.previewPath || path,
            type: file.type || file.name || '材料',
            name: file.name || file.type || '材料'
          }
        })
        .filter(Boolean)
    },

    buildProofSummary(files) {
      const map = {}
      files.forEach(file => { map[file.type] = (map[file.type] || 0) + 1 })
      return Object.keys(map).map(key => ({ name: key, count: map[key] }))
    },
  
    saveRecord() {
      const form = this.data.form
    
      if (!form.title) {
        wx.showToast({ title: '请填写标题', icon: 'none' })
        return
      }
    
      if (!form.date) {
        wx.showToast({ title: '请选择开始日期', icon: 'none' })
        return
      }

      if (form.endDate && form.endDate < form.date) {
        wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
        return
      }
    
      const oldRecords = wx.getStorageSync('records') || []
      const files = this.normalizeStoredFiles(this.data.files || [])
      const proofSummary = this.buildProofSummary(files)
      const privacy = this.normalizePrivacy(form.privacy)
      const category = normalizeCategory(form.category, getUserCategories())
      const tags = normalizeTags(form.tags)
      const cover = files.length > 0 ? files[0].path : ''
    
      if (this.data.isEdit) {
        const updatedRecords = (Array.isArray(oldRecords) ? oldRecords : []).map(item => {
          if (item.id === this.data.editId) {
            return {
              ...item,
              title: form.title,
              date: form.date,
              endDate: form.endDate || '',
              location: form.location || '未填写地点',
              category,
              role: form.role || '未填写身份',
              description: form.description || '暂无备注',
              tags,
              privacy,
              files,
              proofSummary,
              cover,
              photoCount: files.length,
              updatedAt: new Date().toISOString()
            }
          }
          return item
        })
    
        wx.setStorageSync('records', updatedRecords)
        wx.showToast({ title: '修改成功', icon: 'success' })
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/detail/detail?id=${this.data.editId}` })
        }, 600)
        return
      }
    
      const newRecord = {
        id: Date.now().toString(),
        title: form.title,
        date: form.date,
        endDate: form.endDate || '',
        location: form.location || '未填写地点',
        category,
        role: form.role || '未填写身份',
        description: form.description || '暂无备注',
        tags,
        privacy,
        files,
        proofSummary,
        cover,
        photoCount: files.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    
      const records = Array.isArray(oldRecords) ? oldRecords : []
      records.unshift(newRecord)
      wx.setStorageSync('records', records)
      wx.setStorageSync('hasCreatedFirstRecord', true)
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => { wx.switchTab({ url: '/pages/home/home' }) }, 600)
    }
  })