import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, AuthProvider } from '../../entities';
import { ERROR_MESSAGES } from '../../common/constants';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException(ERROR_MESSAGES.AUTH.EMAIL_ALREADY_EXISTS);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);

    const newUser = this.userRepository.create({
      email: createUserDto.email,
      password_hash: hashedPassword,
      full_name: createUserDto.full_name,
      student_id: createUserDto.student_id,
      primary_provider: AuthProvider.EMAIL,
    });

    const savedUser = await this.userRepository.save(newUser);

    const { password_hash, ...result } = savedUser;
    return result;
  }

  findAll() {
    return this.userRepository.find();
  }

  findOne(id: string) {
    return this.userRepository.findOne({ where: { id } });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    if (updateUserDto.password) {
      const hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
      const { password, ...rest } = updateUserDto;
      await this.userRepository.update(id, {
        ...rest,
        password_hash: hashedPassword,
      });
    } else {
      await this.userRepository.update(id, updateUserDto);
    }
    return this.userRepository.findOne({ where: { id } });
  }

  async remove(id: string) {
    await this.userRepository.delete(id);
  }
}
