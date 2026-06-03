const {
  getUserCategories,
  normalizeCategory,
  normalizeTags
} = require('../../utils/categories')

Page({
    data: {
      id: '',
      record: null
    },
  
    onLoad(options) {
      this.setData({ id: options.id })
      this.loadRecord(options.id)
    },
  
    onShow() {
      if (this.data.id) this.loadRecord(this.data.id)
    },

    normalizePrivacy(value) {
      const privateValues = ['private', 'encrypted', 'export_confirm', 'locked']
      return privateValues.includes(value) ? 'private' : 'normal'
    },

    isCloudFilePath(path) {
      return typeof path === 'string' && path.indexOf('cloud://') === 0
    },

    normalizeFiles(files) {
      return (Array.isArray(files) ? files : [])
        .map(file => {
          if (!file) return null
          const path = file.path || file.fileID || file.url || ''
          if (!this.isCloudFilePath(path)) return null
          return {
            id: file.id || path,
            path,
            type: file.type || file.name || '材料',
            name: file.name || file.type || '材料'
          }
        })
        .filter(Boolean)
    },
  
    loadRecord(id) {
      const rawRecords = wx.getStorageSync('records') || []
      const records = Array.isArray(rawRecords) ? rawRecords : []
      const record = records.find(item => item.id === id)
  
      if (!record) {
        wx.showToast({ title: '记录不存在', icon: 'none' })
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/index/index' })
        }, 800)
        return
      }

      const privacy = this.normalizePrivacy(record.privacy)
      const categories = getUserCategories()
      const files = this.normalizeFiles(record.files)
  
      this.setData({
        record: {
          ...record,
          category: normalizeCategory(record.category, categories),
          tags: normalizeTags(record.tags),
          proofSummary: Array.isArray(record.proofSummary) ? record.proofSummary : [],
          files,
          privacy,
          isPrivate: privacy === 'private',
          dateRangeText: this.formatDateRange(record)
        }
      })
    },

    formatDateRange(record) {
      if (record.endDate && record.endDate !== record.date) {
        return `${record.date} 至 ${record.endDate}`
      }

      return record.date || ''
    },
  
    goBack() {
      wx.redirectTo({ url: '/pages/index/index' })
    },
  
    editRecord() {
      wx.navigateTo({ url: `/pages/add/add?id=${this.data.record.id}` })
    },

    goList() {
      wx.switchTab({ url: '/pages/index/index' })
    },

    deleteCloudFiles(files) {
      const fileList = (files || [])
        .map(item => item && (item.path || item.fileID || item.url))
        .filter(path => this.isCloudFilePath(path))

      if (!fileList.length) return

      wx.cloud.deleteFile({
        fileList,
        success: res => {
          console.log('记录关联图片已清理：', res.fileList)
        },
        fail: err => {
          console.error('记录关联图片清理失败：', err)
        }
      })
    },
  
    deleteRecord() {
      wx.showModal({
        title: '删除记录',
        content: '确定要删除这条记录吗？删除后会同步清理它关联的云端图片。',
        confirmText: '删除',
        confirmColor: '#B24A3B',
        success: res => {
          if (!res.confirm) return
    
          const id = this.data.id
          const record = this.data.record || {}
          const records = wx.getStorageSync('records') || []
          const newRecords = records.filter(item => item.id !== id)
    
          wx.setStorageSync('records', newRecords)
          this.deleteCloudFiles(record.files || [])
    
          wx.showToast({ title: '已删除', icon: 'success' })
    
          setTimeout(() => {
            wx.switchTab({ url: '/pages/index/index' })
          }, 600)
        }
      })
    },

    getPreviewUrls() {
      return ((this.data.record && this.data.record.files) || [])
        .map(item => item && item.path)
        .filter(Boolean)
    },

    previewHeroImage(e) {
      const index = e.currentTarget.dataset.index
      const urls = this.getPreviewUrls()
      if (!urls.length || !urls[index]) return
      wx.previewImage({ current: urls[index], urls })
    },
  
    previewImage(e) {
      const index = e.currentTarget.dataset.index
      const urls = this.getPreviewUrls()
      if (!urls.length || !urls[index]) return
      wx.previewImage({ current: urls[index], urls })
    },

    onImageError(e) {
      console.error('详情页图片加载失败：', e.detail)
    },

    confirmPrivateExport(callback) {
      const record = this.data.record

      if (!record || !record.isPrivate) {
        callback()
        return
      }

      wx.showModal({
        title: '导出确认',
        content: '当前导出内容包含私密记录，是否确认继续导出？',
        confirmText: '继续导出',
        cancelText: '取消',
        success: res => {
          if (res.confirm) callback()
        }
      })
    },
  
    generateProof() {
      this.confirmPrivateExport(() => {
        wx.navigateTo({ url: `/pages/proof/proof?id=${this.data.record.id}` })
      })
    }
  })