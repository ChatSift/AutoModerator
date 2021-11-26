import dynamic from 'next/dynamic';
import { Box, Heading } from '@chakra-ui/react';
import LoginProtectedPage from '~/HOCs/LoginProtectedPage';
import GuildLayout from '~/components/GuildLayout';

const AutoModerationSettings = dynamic(() => import('~/components/AutoModerationSettings'));
const NSFWDetectionSettings = dynamic(() => import('~/components/NSFWDetectionSettings'));

const AutoModerationModulePage = () => (
  <GuildLayout>
    <Box my = {{ base: 12 }} px = {{ base: 50, xl: 150 }}>
      <Heading mb = {8} size = "md">
        Auto Moderation Settings
      </Heading>
      <AutoModerationSettings />
      <Heading mb = {8} size = "md">
        NSFW Detection Settings
      </Heading>
      <NSFWDetectionSettings />
    </Box>
  </GuildLayout>
);

export default LoginProtectedPage(AutoModerationModulePage);
