require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  freshservice: {
    domain: process.env.FRESHSERVICE_DOMAIN || 'voetur1.freshservice.com',
    apiKey: process.env.FRESHSERVICE_API_KEY,
    workspaceId: parseInt(process.env.FRESHSERVICE_WORKSPACE_ID) || 18,
    defaultGroupId: parseInt(process.env.FRESHSERVICE_DEFAULT_GROUP_ID) || 21000569060,
    defaultDepartmentId: parseInt(process.env.FRESHSERVICE_DEFAULT_DEPARTMENT_ID) || 21000431906,
    defaultPriority: parseInt(process.env.FRESHSERVICE_DEFAULT_PRIORITY) || 2,
    defaultSource: parseInt(process.env.FRESHSERVICE_DEFAULT_SOURCE) || 4,
    defaultCategory: process.env.FRESHSERVICE_DEFAULT_CATEGORY || 'SUPORTE TÉCNICO',
    defaultSubcategory: process.env.FRESHSERVICE_DEFAULT_SUBCATEGORY || 'Outros Atendimentos',
  },
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    appSecret: process.env.WHATSAPP_APP_SECRET,
    version: process.env.WHATSAPP_VERSION || 'v18.0',
    apiUrl: 'https://graph.facebook.com'
  }
};
