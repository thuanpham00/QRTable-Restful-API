# Lưu ý Database trên Server local và Docker

Khi dùng SQLite, database là file local nên mỗi môi trường (server local và Docker) sẽ có một database riêng → dữ liệu không đồng bộ. 
Nếu chuyển sang các hệ quản trị như MySQL hoặc MongoDB, dữ liệu chỉ đồng bộ khi cả hai môi trường cùng kết nối tới một database server chung; 
nếu mỗi bên vẫn dùng database riêng thì vẫn không sync. Vì vậy, muốn đồng bộ dữ liệu giữa local và Docker, 
cần đảm bảo chúng cùng truy cập vào cùng một nguồn database.