import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../common/enums';
import type { AuthorizedRequest } from '../auth/auth.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskWriteRateLimitGuard } from './guards/task-write-rate-limit.guard';
import { PaginatedTasksEntity, TaskResponseEntity } from './entities/task-response.entity';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiExtraModels(TaskResponseEntity, PaginatedTasksEntity)
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({
    summary: 'List internal tasks for groups the caller has joined',
  })
  @ApiQuery({ name: 'group_id', required: false, example: '11111111-1111-1111-1111-111111111111' })
  @ApiQuery({ name: 'status', required: false, enum: ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] })
  @ApiQuery({ name: 'assignee_id', required: false, example: '22222222-2222-2222-2222-222222222222' })
  @ApiQuery({ name: 'search', required: false, example: 'mobile' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, type: PaginatedTasksEntity })
  async findAll(@Req() req: AuthorizedRequest, @Query() query: QueryTasksDto) {
    return this.tasksService.findAll(req.user.id, query);
  }

  @Post()
  @UseGuards(TaskWriteRateLimitGuard)
  @ApiOperation({ summary: 'Create internal task for a group' })
  @ApiBody({
    type: CreateTaskDto,
    examples: {
      leaderCreateTask: {
        summary: 'Create a task for a joined group',
        value: {
          group_id: '11111111-1111-1111-1111-111111111111',
          title: 'Prepare mobile task payload',
          description: 'Align mobile task card with BE contract.',
          status: 'TODO',
          priority: 'HIGH',
          assignee_id: '22222222-2222-2222-2222-222222222222',
          due_at: '2026-03-25T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: TaskResponseEntity })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Task or group not found' })
  async create(@Req() req: AuthorizedRequest, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(req.user.id, req.user.role as Role, dto);
  }

  @Patch(':id')
  @UseGuards(TaskWriteRateLimitGuard)
  @ApiOperation({ summary: 'Update internal task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiBody({
    type: UpdateTaskDto,
    examples: {
      updateStatusAndAssignee: {
        summary: 'Move task and assign a member',
        value: {
          status: 'IN_PROGRESS',
          priority: 'URGENT',
          assignee_id: '22222222-2222-2222-2222-222222222222',
        },
      },
    },
  })
  @ApiResponse({ status: 200, type: TaskResponseEntity })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Task or group not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthorizedRequest,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, req.user.id, req.user.role as Role, dto);
  }

  @Delete(':id')
  @UseGuards(TaskWriteRateLimitGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete internal task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({ status: 204, description: 'Task deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Task or group not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthorizedRequest,
  ) {
    await this.tasksService.remove(id, req.user.id, req.user.role as Role);
  }
}
