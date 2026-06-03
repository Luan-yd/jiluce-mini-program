function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== ''
}

function isCloudFilePath(path) {
  return typeof path === 'string' && path.indexOf('cloud://') === 0
}

function pushImage(images, value) {
  if (!isNonEmptyString(value)) return
  const path = value.trim()
  if (!images.includes(path)) images.push(path)
}

function pushFileImage(images, file) {
  if (!file) return

  if (typeof file === 'string') {
    pushImage(images, file)
    return
  }

  // Prefer the persistent file fields used by detail/export, then fall back to local preview paths.
  ;['path', 'fileID', 'url', 'src', 'tempPath', 'previewPath', 'canvasPath', 'drawPath'].forEach(key => {
    pushImage(images, file[key])
  })
}

function normalizeRecordImages(record) {
  const safeRecord = record || {}
  const images = []

  ;['files', 'materials', 'images', 'imageList', 'photos'].forEach(key => {
    const list = safeRecord[key]
    if (Array.isArray(list)) {
      list.forEach(item => pushFileImage(images, item))
    }
  })

  ;['coverImage', 'cover', 'thumbnail'].forEach(key => {
    pushImage(images, safeRecord[key])
  })

  return images
}

function getRecordCover(record) {
  return normalizeRecordImages(record)[0] || ''
}

function getRecordPhotoCount(record) {
  const safeRecord = record || {}
  const files = Array.isArray(safeRecord.files) ? safeRecord.files : []
  const images = normalizeRecordImages(safeRecord)

  return safeRecord.photoCount || files.length || images.length || 0
}

function getTempFileURL(fileList) {
  if (!fileList.length || !wx.cloud || !wx.cloud.getTempFileURL) {
    return Promise.resolve({})
  }

  return new Promise(resolve => {
    wx.cloud.getTempFileURL({
      fileList,
      success: res => {
        const map = {}
        ;(res.fileList || []).forEach(item => {
          if (item && item.fileID) {
            map[item.fileID] = item.tempFileURL || item.fileID
          }
        })
        resolve(map)
      },
      fail: err => {
        console.error('封面图片临时链接获取失败：', err)
        resolve({})
      }
    })
  })
}

async function resolveRecordCovers(records) {
  const safeRecords = Array.isArray(records) ? records : []
  const nextRecords = safeRecords.map(item => {
    const coverSource = getRecordCover(item)
    return {
      ...item,
      coverSource,
      coverDisplay: isCloudFilePath(coverSource) ? '' : coverSource,
      photoCount: getRecordPhotoCount(item)
    }
  })

  const cloudFileList = Array.from(new Set(
    nextRecords
      .map(item => item.coverSource)
      .filter(path => isCloudFilePath(path))
  ))

  const tempURLMap = await getTempFileURL(cloudFileList)

  return nextRecords.map(item => {
    if (!isCloudFilePath(item.coverSource)) return item

    return {
      ...item,
      coverDisplay: tempURLMap[item.coverSource] || ''
    }
  })
}

module.exports = {
  getRecordCover,
  normalizeRecordImages,
  resolveRecordCovers,
  isCloudFilePath
}
