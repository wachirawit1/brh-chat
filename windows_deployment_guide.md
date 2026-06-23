# 🖥️ คู่มือการนำระบบ BRH Chat ขึ้น Windows Server (ผ่าน iisnode)

เอกสารนี้คือขั้นตอนแบบจับมือทำ (Step-by-Step) เพื่อเอาระบบ BRH Chat ไปติดตั้งบน Windows Server โดยใช้ **IIS (Internet Information Services)** ร่วมกับ **iisnode** 

**ข้อดีของการใช้ iisnode:** 
- ไม่ต้องเปิดหน้าจอ Command Prompt ค้างไว้
- ถ้าระบบค้าง IIS จะรีสตาร์ทตัว Node.js ให้เอง
- เมื่อ Windows Server รีสตาร์ท ตัวเว็บก็พร้อมใช้งานอัตโนมัติ

---

## 🛠️ ส่วนที่ 1: ติดตั้งโปรแกรมที่จำเป็น (ทำครั้งเดียว)

บนเครื่อง Windows Server ให้ดาวน์โหลดและติดตั้งโปรแกรมเหล่านี้ตามลำดับ:

1. **Node.js (LTS Version)**
   - โหลดตัว `.msi` จาก [nodejs.org](https://nodejs.org/)
   - กด Next ไปเรื่อยๆ จนติดตั้งเสร็จ
2. **IIS (Internet Information Services)**
   - เปิดโปรแกรม `Server Manager` -> เลือก `Add roles and features`
   - ติ๊กเลือกติดตั้งบทบาท **Web Server (IIS)**
   - ⚠️ สำคัญมาก: ในหน้า Features ให้ไปที่หมวดหมู่ `Application Development` แล้วเปิดใช้งาน **WebSocket Protocol** (ระบบแชทเรียลไทม์ต้องใช้)
3. **URL Rewrite Module**
   - เป็นปลั๊กอินสำหรับ IIS ให้โหลดตัวติดตั้งจาก [iis.net/downloads/microsoft/url-rewrite](https://www.iis.net/downloads/microsoft/url-rewrite) และติดตั้ง
4. **iisnode**
   - เป็นปลั๊กอินที่ทำให้ IIS เข้าใจ Node.js ให้โหลดตัวติดตั้งแบบ x64 จาก [github.com/tjanczuk/iisnode/releases](https://github.com/tjanczuk/iisnode/releases) (เช่น `iisnode-full-v0.2.26-x64.msi`) และติดตั้ง

---

## 📂 ส่วนที่ 2: การเตรียมไฟล์โปรเจกต์และฐานข้อมูล

1. **เอาไฟล์โปรเจกต์ไปวาง**
   - นำโฟลเดอร์โปรเจกต์ `brh-chat` ทั้งหมดไปวางไว้ที่ `C:\inetpub\wwwroot\brh-chat`
2. **ตั้งค่าฐานข้อมูล**
   - เข้าไปในโฟลเดอร์ `C:\inetpub\wwwroot\brh-chat`
   - หาไฟล์ชื่อ `.env` เปิดด้วย Notepad เพื่อตั้งค่าเชื่อมต่อฐานข้อมูลตัวจริง
     ```env
     PORT=process.env.PORT
     SESSION_SECRET=ใส่รหัสลับอะไรก็ได้_ห้ามบอกใคร
     DB_HOST=127.0.0.1
     DB_PORT=3306
     DB_USER=ชื่อผู้ใช้_mysql
     DB_PASS=รหัสผ่าน_mysql
     DB_NAME=brh_chat
     ```
   *(หมายเหตุ: ไฟล์ `web.config` มีการเตรียมไว้ให้พร้อมแล้ว ไม่ต้องแก้ไขใดๆ)*
3. **ติดตั้ง Library (Node_modules)**
   - กดปุ่ม Windows พิมพ์ `cmd` แล้วเปิด Command Prompt
   - พิมพ์คำสั่งเพื่อเข้าไปยังโฟลเดอร์โปรเจกต์:
     ```cmd
     cd C:\inetpub\wwwroot\brh-chat
     ```
   - สั่งติดตั้ง Library:
     ```cmd
     npm install
     ```
4. **สร้างตารางในฐานข้อมูล (กรณีติดตั้งใหม่)**
   - หากฐานข้อมูลยังว่างเปล่า ให้รันคำสั่ง:
     ```cmd
     node setup_db.js
     ```

---

## 🔑 ส่วนที่ 3: การตั้งค่าสิทธิ์โฟลเดอร์ (Permission)

เพื่อให้ IIS สามารถอ่านและเขียนไฟล์ในโฟลเดอร์นี้ได้ (เช่น เซฟรูปลงโฟลเดอร์ /public/uploads และเขียน log) เราต้องให้สิทธิ์ **IIS_IUSRS**

1. คลิกขวาที่โฟลเดอร์ `C:\inetpub\wwwroot\brh-chat` -> เลือก **Properties**
2. ไปที่แท็บ **Security** -> กดปุ่ม **Edit...**
3. กดปุ่ม **Add...** -> พิมพ์คำว่า `IIS_IUSRS` แล้วกด OK
4. ในตารางช่อง Permission ด้านล่าง ให้ติ๊กถูกที่ช่อง **Full control** (Allow)
5. กด Apply และ OK จนปิดหน้าต่างทั้งหมด

---

## 🌐 ส่วนที่ 4: นำขึ้น IIS (สร้าง Website ใหม่ตั้งแต่ต้น)

หากคุณไม่เคยใช้ IIS หรือสับสนกับหน้าต่างของมัน ให้ทำตามนี้ทีละคลิกครับ:

1. **เปิดโปรแกรม IIS**
   - กดปุ่ม Windows พิมพ์คำว่า `IIS` แล้วคลิกเปิดโปรแกรม **Internet Information Services (IIS) Manager**
2. **ปิดเว็บเก่า (ถ้าไม่ได้ใช้)**
   - ที่แถบเมนูด้านซ้ายสุด ให้กดขยายเครื่องหมายลูกศรหน้าชื่อ Server ของคุณ
   - กดขยายที่โฟลเดอร์ **Sites**
   - คุณจะเห็น **Default Web Site** ให้คลิกขวาที่ชื่อนี้ แล้วเลือก **Manage Website -> Stop** (เพื่อเปิดทางให้เว็บแชทของเราใช้ Port 80 ได้)
3. **สร้าง Website ใหม่**
   - คลิกขวาที่โฟลเดอร์ **Sites** แล้วเลือก **Add Website...**
   - จะมีหน้าต่างเด้งขึ้นมา ให้กรอกข้อมูล 3 ช่องนี้:
     - **Site name:** พิมพ์ว่า `brh-chat`
     - **Physical path:** กดปุ่ม `...` แล้วเลือกโฟลเดอร์ที่เราเอาโปรเจกต์ไปวาง คือ `C:\inetpub\wwwroot\brh-chat`
     - **Port:** ปล่อยเป็น `80` เหมือนเดิม
   - กด **OK** 
4. **ปรับ Application Pool ให้รองรับ Node.js**
   - ไปที่แถบเมนูด้านซ้ายสุด คลิกที่ **Application Pools**
   - ตรงกลางหน้าจอ คุณจะเห็นรายชื่อ Pool ให้ดับเบิ้ลคลิกที่ชื่อ **brh-chat** (มันถูกสร้างมาพร้อมตอนตั้งชื่อเว็บ)
   - จะมีหน้าต่างเด้งขึ้นมา ดูที่ช่อง **.NET CLR version**
   - ให้เปลี่ยนจาก v4.0 เป็น **No Managed Code** (สำคัญมาก เพราะ Node.js ไม่ได้รันบน .NET)
   - กด **OK**

---

## 🎉 ส่วนที่ 5: ทดสอบการใช้งาน

ทดลองเข้าเว็บบนเบราว์เซอร์ โดยพิมพ์:
`http://localhost/brh-chat` หรือ `http://[IP-ของ-Server]/brh-chat`

ระบบก็จะทำงานได้ทันที โดยที่ไม่มีหน้าจอสีดำใดๆ เปิดค้างไว้เลยครับ!

> **เคล็ดลับสำหรับการอัดเสียง:** 
> ตามกฎของเบราว์เซอร์ยุคใหม่ หากต้องการใช้งาน **ไมโครโฟน** เว็บจำเป็นต้องรันบน **HTTPS** (หรือรันบน localhost)
> หากนำไปใช้ในวงแลน ให้คุณ Bind SSL Certificate บน Default Web Site ผ่าน IIS ให้เป็น HTTPS เสียก่อน แล้วถึงจะสามารถส่งไฟล์เสียงผ่านเครือข่ายได้ครับ

---

## 🛠️ ส่วนที่ 6: การแก้ไขปัญหาที่พบบ่อย (Troubleshooting)

### ❓ เจอหน้าจอ HTTP Error 500.19 ตอนเข้าใช้งานเว็บครั้งแรก
หากเจอหน้านี้และเขียนรหัสข้อผิดพลาดต่างๆ ให้แก้ตามนี้ครับ:

#### 1. รหัสข้อผิดพลาด `0x8007000d` (Configuration data is invalid)
* **สาเหตุ:** IIS ไม่เข้าใจแท็กการตั้งค่าในไฟล์ `web.config` เนื่องจากยังติดตั้งโมดูลไม่ครบ
* **วิธีแก้:** 
  * เช็กให้แน่ใจว่าติดตั้ง **URL Rewrite Module** และ **iisnode (x64)** แล้ว
  * หากเปิดใช้งานฟีเจอร์ WebSocket ไม่ผ่านใน Server Manager ให้ใช้ PowerShell (Administrator) รันคำสั่งนี้เพื่อติดตั้งแบบข้ามสแกนเนอร์:
    ```powershell
    Dism /Online /Enable-Feature /FeatureName:IIS-WebSockets /All
    ```

#### 2. รหัสข้อผิดพลาด `0x80070021` (This configuration section cannot be used at this path)
* **สาเหตุ:** ส่วนควบคุมการตั้งค่า Handlers ถูกล็อกสิทธิ์เอาไว้ที่ระดับเซิร์ฟเวอร์หลัก
* **วิธีแก้:** ปลดล็อกสิทธิ์โดยเปิด PowerShell (Administrator) แล้วรันคำสั่งนี้:
  ```powershell
  & "$env:windir\system32\inetsrv\appcmd.exe" unlock config -section:system.webServer/handlers -commitpath:apphost
  ```

