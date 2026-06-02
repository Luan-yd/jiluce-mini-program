function normalizePrivacy(value) {
  const privateValues = ['private', 'encrypted', 'export_confirm', 'locked']
  return privateValues.includes(value) ? 'private' : 'normal'
}

function formatDateRange(record) {
  if (record && record.endDate && record.endDate !== record.date) return `${record.date} 至 ${record.endDate}`
  return (record && record.date) || ''
}

function buildExportRecords(records) {
  return (Array.isArray(records) ? records : []).map(item => {
    const safeItem = item || {}
    const privacy = normalizePrivacy(safeItem.privacy)
    return {
      title: safeItem.title || '未命名记录',
      date: safeItem.date || '',
      endDate: safeItem.endDate || '',
      dateRangeText: safeItem.dateRangeText || formatDateRange(safeItem),
      category: safeItem.category || '',
      location: safeItem.location || '',
      role: safeItem.role || '',
      description: safeItem.description || '',
      tags: Array.isArray(safeItem.tags) ? safeItem.tags : [],
      privacy,
      proofSummary: Array.isArray(safeItem.proofSummary) ? safeItem.proofSummary : [],
      files: Array.isArray(safeItem.files)
        ? safeItem.files.map(file => ({
            type: file.type || file.name || '材料',
            path: file.path || file.fileID || file.url || ''
          })).filter(file => file.path)
        : []
    }
  })
}

function containsPrivate(records) {
  return (Array.isArray(records) ? records : []).some(item => {
    const privacy = normalizePrivacy(item && item.privacy)
    return privacy === 'private' || item.isPrivate
  })
}

function confirmPrivateExport(records) {
  if (!containsPrivate(records)) return Promise.resolve(true)

  return new Promise(resolve => {
    wx.showModal({
      title: '导出确认',
      content: '当前导出内容包含私密记录，是否确认继续导出？',
      confirmText: '继续导出',
      cancelText: '取消',
      success: res => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
}

function deleteGeneratedWord(fileID) {
  if (!fileID) return
  wx.cloud.deleteFile({
    fileList: [fileID],
    success: () => console.log('合并导出 Word 云文件已清理'),
    fail: err => console.error('合并导出 Word 云文件清理失败：', err)
  })
}

async function exportRecordsToWord(records, exportMeta, options) {
  const safeRecords = Array.isArray(records) ? records : []
  const safeOptions = options || {}

  if (!safeRecords.length) {
    wx.showToast({ title: safeOptions.emptyText || '暂无可导出的记录', icon: 'none' })
    return false
  }

  const confirmed = await confirmPrivateExport(safeRecords)
  if (!confirmed) return false

  wx.showLoading({ title: '生成Word中…', mask: true })

  try {
    const result = await wx.cloud.callFunction({
      name: 'generateWord',
      data: {
        records: buildExportRecords(safeRecords),
        exportMeta: {
          title: exportMeta && exportMeta.title ? exportMeta.title : '筛选合并导出',
          condition: exportMeta && exportMeta.condition ? exportMeta.condition : '',
          exportedAt: exportMeta && exportMeta.exportedAt ? exportMeta.exportedAt : new Date().toLocaleString(),
          type: exportMeta && exportMeta.type ? exportMeta.type : 'merge'
        }
      }
    })

    wx.hideLoading()

    if (!result.result || !result.result.success) {
      const errorText = result.result && result.result.error ? result.result.error : '生成失败'
      wx.showToast({ title: errorText, icon: 'none' })
      return false
    }

    const fileID = result.result.fileID
    const downloadResult = await wx.cloud.downloadFile({ fileID })
    deleteGeneratedWord(fileID)

    wx.openDocument({
      filePath: downloadResult.tempFilePath,
      fileType: 'docx',
      showMenu: true,
      success: () => wx.showToast({ title: '已生成Word', icon: 'success' }),
      fail: err => {
        console.error('打开 Word 失败：', err)
        wx.showToast({ title: '请在文件管理中查看', icon: 'none' })
      }
    })

    return true
  } catch (err) {
    wx.hideLoading()
    console.error('合并导出失败：', err)
    wx.showToast({ title: '生成失败，请重试', icon: 'none' })
    return false
  }
}

module.exports = {
  exportRecordsToWord
}
