class Utils {
  static getRandomInt(a, b) {
    const diff = Math.abs(a - b) + 1;
    return Math.min(a, b) + Math.floor(Math.random() * Math.floor(diff));
  }

  static generateVerifyFp() {
    const t =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(
          ''
        ),
      e = t.length,
      n = Date.now().toString(36),
      r = [];
    (r[8] = r[13] = r[18] = r[23] = '_'), (r[14] = '4');
    for (var o = 0, i = void 0; o < 36; o++)
      r[o] ||
        ((i = 0 | (Math.random() * e)), (r[o] = t[19 == o ? (3 & i) | 8 : i]));
    return 'verify_' + n + '_' + r.join('');
  }
}
module.exports = Utils;
