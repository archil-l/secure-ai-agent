import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConversationRole,
  Message,
} from '@aws-sdk/client-bedrock-runtime';
import { systemPrompt } from './system-prompt';

// Model ID for Claude 3.7 Sonnet
const modelId = 'us.anthropic.claude-3-7-sonnet-20250219-v1:0';

const client = new BedrockRuntimeClient({ region: 'us-east-1' });

export const getBedrockResponse = async (conversation: Message[]) => {
  try {
    const command = new ConverseCommand({
      modelId,
      messages: conversation,
      system: systemPrompt,
      inferenceConfig: {
        temperature: 0.7,
        maxTokens: 500,
      },
    });
    const response = await client.send(command);

    console.log("Claude's Response:");
    if (response.output?.message?.content) {
      for (const contentBlock of response.output.message.content) {
        if (contentBlock.text) {
          console.log(contentBlock.text);
          return contentBlock.text;
        }
      }
    }
  } catch (error) {
    console.error('Error invoking Claude 3.7 Sonnet:', error);
  }
};
