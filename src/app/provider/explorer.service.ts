import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import config from '@app/config';
import PQueue from 'p-queue';

@Injectable()
export class ExplorerService {
  private logger = new Logger(ExplorerService.name);

  // Max 1 call / second to EXPLORER API
  private getTxDetailsQueue: PQueue = new PQueue({
    interval: 1000,
    intervalCap: 1,
  });

  constructor() {
    this.logger.debug(
      `ExplorerService use explorer api at: ${config.EXPLORER_URL}`,
    );
  }

  getTxByMessageHash(messageHash: string): Promise<any> {
    return this.getTxDetailsQueue.add(async () => {
      const { data } = await this.retry(() =>
        axios.get(
          `${
            config.EXPLORER_URL
          }/api/index/getTransactionByInMessageHash?msg_hash=${encodeURIComponent(
            messageHash,
          ).replace('-', '%2B')}&include_msg_body=true`,
          {
            headers: {
              Accept: 'application/json',
            },
          },
        ),
      );
      if (Array.isArray(data) && data.length > 0) return data[0];
      return null;
    });
  }

  private async retry<T>(
    func: () => Promise<T>,
    maxTimes = 3,
    delay = 1000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let times = 0;
      const retryInternal = () => {
        func()
          .then(resolve)
          .catch((err) => {
            times++;
            if (times < maxTimes) {
              setTimeout(retryInternal, delay);
            } else {
              reject(err);
            }
          });
      };
      retryInternal();
    });
  }
}
