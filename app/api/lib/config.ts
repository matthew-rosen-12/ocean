if (!process.env.CHANNELS_APP_ID || 
  !process.env.CHANNELS_APP_SECRET) {
throw new Error('Missing Pusher environment variables');
}

export const config = {
    pusher: {
        appId: process.env.CHANNELS_APP_ID,
        key: '0de6906930ddbfcf4c81',
        secret: process.env.CHANNELS_APP_SECRET,
        cluster: 'us2'
    }
  } as const;
