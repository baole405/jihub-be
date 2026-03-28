import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ReassignmentItemDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'User ID of the member being reassigned',
  })
  @IsUUID('4')
  user_id: string;

  @ApiProperty({
    example: '660e8400-e29b-41d4-a716-446655440000',
    description: 'Target group ID to move this member into',
  })
  @IsUUID('4')
  target_group_id: string;
}

export class ReassignMembersDto {
  @ApiProperty({
    type: [ReassignmentItemDto],
    description:
      'Array of member-to-group reassignment mappings. Can be any subset of the source group members.',
    example: [
      {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        target_group_id: '660e8400-e29b-41d4-a716-446655440000',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReassignmentItemDto)
  assignments: ReassignmentItemDto[];

  @ApiProperty({
    example: false,
    description:
      'Whether to archive the source group after reassignment. Only valid if all members are being moved out. Defaults to false.',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  archive_source?: boolean;
}
