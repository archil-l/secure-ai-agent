import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConversationRole, // Import the enum
} from '@aws-sdk/client-bedrock-runtime';

// Model ID for Claude 3.7 Sonnet
const modelId = 'us.anthropic.claude-3-7-sonnet-20250219-v1:0';

const client = new BedrockRuntimeClient({ region: 'us-east-1' });

export const getBedrockResponse = async (prompt: string) => {
  const input = {
    modelId: modelId,
    messages: [
      {
        role: ConversationRole.USER, // Use the enum value
        content: [
          {
            text: prompt,
          },
        ],
      },
    ],
    inferenceConfig: {
      temperature: 0.7,
      maxTokens: 500,
    },
  };

  try {
    const command = new ConverseCommand(input);
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
