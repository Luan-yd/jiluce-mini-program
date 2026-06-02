const cloud = require('wx-server-sdk')
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  ImageRun
} = require('docx')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function safeFileName(name) {
  return String(name || 'record')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 40)
}

function formatDateRange(record) {
  if (record && record.endDate && record.endDate !== record.date) {
    return `${record.date || ''} 至 ${record.endDate}`
  }

  return (record && record.date) || ''
}

function normalizePrivacy(value) {
  const privateValues = ['private', 'encrypted', 'export_confirm', 'locked']
  return privateValues.includes(value) ? 'private' : 'normal'
}

function getPrivacyText(record) {
  return normalizePrivacy(record && record.privacy) === 'private' ? '私密记录' : '普通记录'
}

async function fetchImageBuffer(filePath) {
  try {
    if (!filePath) return null

    const path = String(filePath)

    if (!path.startsWith('cloud://')) {
      return null
    }

    const result = await cloud.downloadFile({ fileID: path })
    return result && result.fileContent ? result.fileContent : null
  } catch (err) {
    console.error('下载图片失败：', filePath, err)
    return null
  }
}

function addTextParagraph(children, text, options = {}) {
  children.push(
    new Paragraph({
      spacing: options.spacing || { after: 200 },
      alignment: options.alignment,
      children: [
        new TextRun({
          text: String(text || ''),
          size: options.size || 24,
          bold: !!options.bold,
          color: options.color
        })
      ]
    })
  )
}

function addHeading(children, text, level = HeadingLevel.HEADING_1) {
  children.push(
    new Paragraph({
      text,
      heading: level,
      spacing: { before: 200, after: 200 }
    })
  )
}

async function addRecordContent(children, record, options = {}) {
  const dateText = record.dateRangeText || formatDateRange(record) || '未填写'

  if (options.merge) {
    addHeading(children, record.title || '未命名记录', HeadingLevel.HEADING_1)
  } else {
    children.push(
      new Paragraph({
        text: '个人经历',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [
          new TextRun({
            text: record.title || '未命名记录',
            bold: true,
            size: 56
          })
        ]
      })
    )
  }

  const infoRows = [
    `日期：${dateText}`,
    `分类：${record.category || '未填写'}`,
    `地点：${record.location || '未填写'}`,
    `身份：${record.role || '未填写'}`,
    `隐私状态：${getPrivacyText(record)}`
  ]

  infoRows.forEach(text => addTextParagraph(children, text, { size: options.merge ? 22 : 28, spacing: { after: 120 } }))

  addHeading(children, '经历说明')
  addTextParagraph(children, record.description || '暂无说明', { spacing: { after: 400 } })

  if (Array.isArray(record.tags) && record.tags.length > 0) {
    addHeading(children, '标签')
    addTextParagraph(children, record.tags.join('  ·  '), { spacing: { after: 400 } })
  }

  if (Array.isArray(record.proofSummary) && record.proofSummary.length > 0) {
    addHeading(children, '材料概览')
    addTextParagraph(children, record.proofSummary.map(item => `${item.name}${item.count}份`).join('，'), { spacing: { after: 400 } })
  }

  addHeading(children, '材料图片')

  const files = Array.isArray(record.files) ? record.files : []

  if (!files.length) {
    addTextParagraph(children, '暂无图片材料', { size: 22, color: '888888', spacing: { after: 300 } })
    return
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i] || {}
    const fileType = file.type || file.name || `材料${i + 1}`
    const filePath = file.path || file.fileID || file.url || ''

    addTextParagraph(children, fileType, { bold: true, size: 22, spacing: { after: 100 } })

    const buf = await fetchImageBuffer(filePath)

    if (buf) {
      children.push(
        new Paragraph({
          spacing: { after: 300 },
          children: [
            new ImageRun({
              data: buf,
              type: 'png',
              transformation: {
                width: 400,
                height: 300
              }
            })
          ]
        })
      )
    } else {
      addTextParagraph(children, '图片读取失败', { size: 20, color: '888888', spacing: { after: 300 } })
    }
  }
}

async function buildSingleDocument(record) {
  const children = []
  await addRecordContent(children, record, { merge: false })

  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: '本资料包由迹录册根据用户上传材料自动整理生成，让每一段经历，都有迹可循。',
          size: 22,
          color: '888888'
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `生成时间：${new Date().toLocaleDateString('zh-CN')}`,
          size: 22,
          color: '888888'
        })
      ]
    })
  )

  return { children, fileName: safeFileName(record.title) }
}

async function buildMergedDocument(records, exportMeta = {}) {
  const children = []

  children.push(
    new Paragraph({
      text: exportMeta.title || '筛选合并导出',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 }
    })
  )

  addTextParagraph(children, `导出条件：${exportMeta.condition || '未填写'}`, { alignment: AlignmentType.CENTER, size: 24 })
  addTextParagraph(children, `导出时间：${exportMeta.exportedAt || new Date().toLocaleString('zh-CN')}`, { alignment: AlignmentType.CENTER, size: 24, spacing: { after: 500 } })

  for (let i = 0; i < records.length; i++) {
    if (i > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
    }

    await addRecordContent(children, records[i], { merge: true })
  }

  return { children, fileName: '筛选合并导出' }
}

exports.main = async (event) => {
  try {
    const records = Array.isArray(event.records) ? event.records : null
    const record = event.record

    if ((!records || !records.length) && !record) {
      return {
        success: false,
        error: '没有记录数据'
      }
    }

    const docData = records && records.length
      ? await buildMergedDocument(records, event.exportMeta || {})
      : await buildSingleDocument(record)

    const doc = new Document({
      sections: [
        {
          children: docData.children
        }
      ]
    })

    const buffer = await Packer.toBuffer(doc)
    const cloudPath = `word/${Date.now()}_${safeFileName(docData.fileName)}.docx`

    const uploadResult = await cloud.uploadFile({
      cloudPath,
      fileContent: buffer
    })

    return {
      success: true,
      fileID: uploadResult.fileID
    }
  } catch (err) {
    console.error('generateWord 云函数执行失败：', err)

    return {
      success: false,
      error: err.message || '生成 Word 失败'
    }
  }
}
