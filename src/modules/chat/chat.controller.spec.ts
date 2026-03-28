import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatRateLimitService } from './chat-rate-limit.service';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: Record<string, jest.Mock>;

  beforeEach(async () => {
    chatService = {
      getOrCreateConversation: jest.fn(),
      listConversations: jest.fn(),
      listMessages: jest.fn(),
      createMessage: jest.fn(),
      markConversationRead: jest.fn(),
      markMessageRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: chatService },
        {
          provide: ChatRateLimitService,
          useValue: { consume: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(ChatController);
  });

  it('delegates send message to chat service with current user id', async () => {
    await controller.sendMessage(
      { user: { id: 'student-1' } } as any,
      '11111111-1111-1111-1111-111111111111',
      { content: 'hello' },
    );

    expect(chatService.createMessage).toHaveBeenCalledWith(
      'student-1',
      '11111111-1111-1111-1111-111111111111',
      { content: 'hello' },
    );
  });

  it('delegates conversation list to chat service', async () => {
    await controller.listConversations({ user: { id: 'lecturer-1' } } as any);

    expect(chatService.listConversations).toHaveBeenCalledWith('lecturer-1');
  });
});
