import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.util.Enumeration;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

/** Собирает APK: resources.arsc и classes.dex должны лежать без сжатия (требование Android 11+). */
public final class PackApk {

    public static void main(String[] args) throws Exception {
        File base = new File(args[0]);
        File dex = new File(args[1]);
        File out = new File(args[2]);

        ZipFile zip = new ZipFile(base);
        ZipOutputStream zo = new ZipOutputStream(new FileOutputStream(out));
        try {
            Enumeration<? extends ZipEntry> en = zip.entries();
            while (en.hasMoreElements()) {
                ZipEntry e = en.nextElement();
                if ("classes.dex".equals(e.getName())) continue;
                byte[] data = drain(zip.getInputStream(e));
                boolean store = "resources.arsc".equals(e.getName());
                writeEntry(zo, e.getName(), data, store);
            }
            byte[] dexData = drain(new FileInputStream(dex));
            writeEntry(zo, "classes.dex", dexData, true);
        } finally {
            zo.close();
            zip.close();
        }
    }

    private static void writeEntry(ZipOutputStream zo, String name, byte[] data, boolean store) throws Exception {
        ZipEntry ne = new ZipEntry(name);
        ne.setTime(System.currentTimeMillis());
        if (store) {
            CRC32 crc = new CRC32();
            crc.update(data);
            ne.setMethod(ZipEntry.STORED);
            ne.setSize(data.length);
            ne.setCompressedSize(data.length);
            ne.setCrc(crc.getValue());
        } else {
            ne.setMethod(ZipEntry.DEFLATED);
        }
        zo.putNextEntry(ne);
        zo.write(data);
        zo.closeEntry();
    }

    private static byte[] drain(InputStream in) throws Exception {
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream(1 << 16);
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            return bos.toByteArray();
        } finally {
            in.close();
        }
    }
}
