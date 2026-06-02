Page({
  data: {
    tags: [],
    recordCount: 0
  },

  onShow() {
    this.loadTags()
  },

  normalizeTags(value) {
    return Array.isArray(value) ? value.filter(Boolean) : []
  },

  loadTags() {
    const rawRecords = wx.getStorageSync('records') || []
    const records = Array.isArray(rawRecords) ? rawRecords : []
    const tagMap = {}

    records.forEach(record => {
      this.normalizeTags(record && record.tags).forEach(tag => {
        if (!tagMap[tag]) tagMap[tag] = { name: tag, count: 0 }
        tagMap[tag].count += 1
      })
    })

    const tags = Object.keys(tagMap).sort().map(key => tagMap[key])
    this.setData({ tags, recordCount: records.length })
  },

  goBack() {
    wx.navigateBack()
  },

  deleteTag(e) {
    const tag = e.currentTarget.dataset.value
    if (!tag) return

    wx.showModal({
      title: '删除标签',
      content: '删除该标签后，所有记录中的此标签都会被移除，是否继续？',
      confirmText: '删除',
      confirmColor: '#B24A3B',
      success: res => {
        if (!res.confirm) return
        const rawRecords = wx.getStorageSync('records') || []
        const records = Array.isArray(rawRecords) ? rawRecords : []
        const updatedRecords = records.map(record => {
          const safeRecord = record || {}
          const tags = this.normalizeTags(safeRecord.tags).filter(item => item !== tag)
          return { ...safeRecord, tags, updatedAt: new Date().toISOString() }
        })

        wx.setStorageSync('records', updatedRecords)
        wx.showToast({ title: '标签已删除', icon: 'success' })
        this.loadTags()
      }
    })
  }
})
