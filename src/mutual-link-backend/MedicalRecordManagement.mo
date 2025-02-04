import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Result "mo:base/Result";
import Nat "mo:base/Nat";
import Hash "mo:base/Hash";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Int "mo:base/Int";
import Order "mo:base/Order";
import Option "mo:base/Option";
import Error "mo:base/Error";
import DoctorManagement "./DoctorManagement";

module {
    public type MedicalRecord = {
        id: Nat;
        date: Int;
        patientName: Text;
        patientPhone: Text;
        title: Text;
        description: Text;
        fromDoctor: Text;
        fromEmail: Text;
        fromHospital: Text;
        fromDepartment: Text;
        fromPhone: Text;
        toDoctor: Text;
        toEmail: Text;
        toHospital: Text;
        toDepartment: Text;
        toPhone: Text;
        phone: Text;
        cid: Text;
        encryptedAesKeyForSender: Text;
        encryptedAesKeyForReceiver: Text;
        status: Text;  // PENDING_APPROVAL | REJECTED | APPROVED | TRANSFERRED | EXPIRED
        originalRecordId: ?Nat;
        transferredDoctors: [Text];
    };

    public type PagedResult = {
        items: [MedicalRecord];
        total: Nat;
    };

    public class MedicalRecordManager(doctorManager: DoctorManagement.DoctorManager) {
        private var nextId: Nat = 1;
        private var records = HashMap.HashMap<Nat, MedicalRecord>(1, Nat.equal, Hash.hash);

        // 이력 캐시 추가
        private var transferHistoryCache = HashMap.HashMap<Nat, [Nat]>(1, Nat.equal, Hash.hash);

        // 이력 캐시 업데이트 함수
        private func updateTransferHistoryCache(originalId: Nat, newRecordId: Nat) {
            switch (transferHistoryCache.get(originalId)) {
                case (?history) {
                    transferHistoryCache.put(originalId, Array.append(history, [newRecordId]));
                };
                case null {
                    transferHistoryCache.put(originalId, [newRecordId]);
                };
            };
        };

        public func createMedicalRecord(
            patientName: Text,
            patientPhone: Text,
            title: Text,
            description: Text,
            fromEmail: Text,
            toEmail: Text,
            cid: Text,
            encryptedAesKeyForSender: Text,
            encryptedAesKeyForReceiver: Text
        ) : Result.Result<MedicalRecord, Text> {
            // 송신자 정보 조회
            switch (doctorManager.getDoctorByEmail(fromEmail)) {
                case (null) { #err("송신자 정보를 찾을 수 없습니다.") };
                case (?sender) {
                    // 수신자 정보 조회
                    switch (doctorManager.getDoctorByEmail(toEmail)) {
                        case (null) { #err("수신자 정보를 찾을 수 없습니다.") };
                        case (?receiver) {
                            // 진료 기록 생성
                            let record = {
                                id = nextId;
                                date = Time.now();
                                patientName = patientName;
                                patientPhone = patientPhone;
                                title = title;
                                description = description;
                                fromDoctor = sender.name;
                                fromEmail = sender.email;
                                fromHospital = sender.hospital;
                                fromDepartment = sender.department;
                                fromPhone = sender.phone;
                                toDoctor = receiver.name;
                                toEmail = receiver.email;
                                toHospital = receiver.hospital;
                                toDepartment = receiver.department;
                                toPhone = receiver.phone;
                                phone = sender.phone;
                                cid = cid;
                                encryptedAesKeyForSender = encryptedAesKeyForSender;
                                encryptedAesKeyForReceiver = encryptedAesKeyForReceiver;
                                status = "APPROVED";  // 환자 승인 프로세스 구현 전까지는 자동 승인
                                originalRecordId = null;
                                transferredDoctors = [sender.name];
                            };

                            records.put(nextId, record);
                            nextId += 1;
                            #ok(record)
                        };
                    };
                };
            };
        };

        public func updateMedicalRecordStatus(id: Nat, status: Text) : Result.Result<MedicalRecord, Text> {
            switch (records.get(id)) {
                case (null) { #err("해당 ID의 진료 기록을 찾을 수 없습니다.") };
                case (?record) {
                    let updatedRecord: MedicalRecord = {
                        id = record.id;
                        date = record.date;
                        patientName = record.patientName;
                        patientPhone = record.patientPhone;
                        title = record.title;
                        description = record.description;
                        fromDoctor = record.fromDoctor;
                        fromEmail = record.fromEmail;
                        fromHospital = record.fromHospital;
                        fromDepartment = record.fromDepartment;
                        fromPhone = record.fromPhone;
                        toDoctor = record.toDoctor;
                        toEmail = record.toEmail;
                        toHospital = record.toHospital;
                        toDepartment = record.toDepartment;
                        toPhone = record.toPhone;
                        phone = record.phone;
                        cid = record.cid;
                        encryptedAesKeyForSender = record.encryptedAesKeyForSender;
                        encryptedAesKeyForReceiver = record.encryptedAesKeyForReceiver;
                        status = status;
                        originalRecordId = record.originalRecordId;
                        transferredDoctors = record.transferredDoctors;
                    };
                    records.put(id, updatedRecord);
                    #ok(updatedRecord)
                };
            }
        };

        public func getAllMedicalRecords(offset: Nat, limit: Nat) : PagedResult {
            let allRecords = Iter.toArray(records.vals());
            
            // ID 기준 내림차순 정렬
            let sortedRecords = Array.sort<MedicalRecord>(
                allRecords,
                func(a: MedicalRecord, b: MedicalRecord) : Order.Order {
                    if (a.id > b.id) { #less } 
                    else if (a.id < b.id) { #greater } 
                    else { #equal }
                }
            );

            // 페이지네이션 적용
            let total = sortedRecords.size();
            let start = if (offset >= total) { total } else { offset };
            let end = if (start + limit > total) { total } else { start + limit };
            let pagedRecords = Array.tabulate<MedicalRecord>(
                end - start,
                func(i: Nat) : MedicalRecord { sortedRecords[start + i] }
            );

            {
                items = pagedRecords;
                total = total;
            }
        };

        public func getMedicalRecordsByDoctor(doctorName: Text, role: Text, offset: Nat, limit: Nat) : {
            items: [MedicalRecord];
            total: Nat;
        } {
            let allRecords = Iter.toArray(records.vals());
            
            // 1. 해당 의사의 진료 기록 필터링
            let filteredRecords = Array.filter<MedicalRecord>(allRecords, func(record: MedicalRecord) : Bool {
                if (role == "sender") {
                    // 송신자인 경우:
                    // 1) 자신이 최초 생성한 기록 또는
                    // 2) 자신이 이관한 기록
                    record.fromDoctor == doctorName
                } else {
                    // 수신자인 경우: 자신이 수신자로 지정된 기록 표시
                    record.toDoctor == doctorName
                }
            });

            // 2. ID 기준 내림차순 정렬
            let sortedRecords = Array.sort<MedicalRecord>(
                filteredRecords,
                func(a: MedicalRecord, b: MedicalRecord) : Order.Order {
                    if (a.id > b.id) { #less } 
                    else if (a.id < b.id) { #greater } 
                    else { #equal }
                }
            );

            // 3. 페이지네이션 적용
            let total = sortedRecords.size();
            let start = if (offset >= total) { total } else { offset };
            let end = if (start + limit > total) { total } else { start + limit };
            let pagedRecords = Array.tabulate<MedicalRecord>(
                end - start,
                func(i: Nat) : MedicalRecord { sortedRecords[start + i] }
            );

            {
                items = pagedRecords;
                total = total;
            }
        };

        public func getMedicalRecord(id: Nat) : ?MedicalRecord {
            records.get(id)
        };

        // 진료 기록 이관 이력 조회 함수 개선
        public func getTransferHistory(recordId: Nat) : [MedicalRecord] {
            // 1. 최초 기록 ID 찾기
            var originalId = recordId;
            var currentId = recordId;
            
            label l loop {
                switch (records.get(currentId)) {
                    case (null) { break l };
                    case (?currentRecord) {
                        switch (currentRecord.originalRecordId) {
                            case (null) { 
                                originalId := currentRecord.id;
                                break l 
                            };
                            case (?id) { 
                                currentId := id;
                            };
                        };
                    };
                };
            };

            // 2. 최초 기록 가져오기
            switch (records.get(originalId)) {
                case (null) { [] };
                case (?originalRecord) {
                    // 3. 관련 기록 찾기 (최초 기록은 제외)
                    let allRecords = Iter.toArray(records.vals());
                    let relatedRecords = Array.filter<MedicalRecord>(
                        allRecords,
                        func (record: MedicalRecord) : Bool {
                            switch (record.originalRecordId) {
                                case (null) { false };  // 최초 기록은 제외
                                case (?id) { id == originalId };
                            }
                        }
                    );

                    // 4. 캐시 업데이트
                    let recordIds = Array.map<MedicalRecord, Nat>(
                        relatedRecords,
                        func (record: MedicalRecord) : Nat { record.id }
                    );
                    transferHistoryCache.put(originalId, Array.append([originalId], recordIds));

                    // 5. 시간순 정렬된 결과 반환 (최초 기록을 맨 앞에 추가)
                    Array.sort<MedicalRecord>(
                        Array.append([originalRecord], relatedRecords),
                        func(a: MedicalRecord, b: MedicalRecord) : Order.Order {
                            if (a.date < b.date) { #less } 
                            else if (a.date > b.date) { #greater } 
                            else { #equal }
                        }
                    )
                };
            }
        };

        // 이관 가능 여부 확인 함수
        private func canTransfer(record: MedicalRecord, doctorName: Text) : Bool {
            let isCurrentReceiver = record.toDoctor == doctorName;
            let hasNotTransferred = record.status == "APPROVED";  // APPROVED 상태에서만 이관 가능
            isCurrentReceiver and hasNotTransferred
        };

        // 진료 기록 이관 함수 수정
        public func transferMedicalRecord(
            recordId: Nat,
            fromEmail: Text,
            toEmail: Text,
            encryptedAesKeyForSender: Text,
            encryptedAesKeyForReceiver: Text
        ) : Result.Result<MedicalRecord, Text> {
            switch (records.get(recordId)) {
                case (null) { #err("해당 ID의 진료 기록을 찾을 수 없습니다.") };
                case (?record) {
                    // 송신자 정보 조회
                    switch (doctorManager.getDoctorByEmail(fromEmail)) {
                        case (null) { #err("송신자 정보를 찾을 수 없습니다.") };
                        case (?sender) {
                            if (not canTransfer(record, sender.name)) {
                                #err("이관 권한이 없습니다.")
                            } else {
                                // 수신자 정보 조회
                                switch (doctorManager.getDoctorByEmail(toEmail)) {
                                    case (null) { #err("수신자 정보를 찾을 수 없습니다.") };
                                    case (?receiver) {
                                        // 최초 기록 ID 찾기
                                        var originalId = recordId;
                                        var currentId = recordId;
                                        
                                        label l loop {
                                            switch (records.get(currentId)) {
                                                case (null) { break l };
                                                case (?currentRecord) {
                                                    switch (currentRecord.originalRecordId) {
                                                        case (null) { 
                                                            originalId := currentRecord.id;
                                                            break l 
                                                        };
                                                        case (?id) { 
                                                            currentId := id;
                                                        };
                                                    };
                                                };
                                            };
                                        };

                                        let newRecord: MedicalRecord = {
                                            id = nextId;
                                            date = Time.now();
                                            patientName = record.patientName;
                                            patientPhone = record.patientPhone;
                                            title = record.title;
                                            description = record.description;
                                            fromDoctor = sender.name;
                                            fromEmail = sender.email;
                                            fromHospital = sender.hospital;
                                            fromDepartment = sender.department;
                                            fromPhone = sender.phone;
                                            toDoctor = receiver.name;
                                            toEmail = receiver.email;
                                            toHospital = receiver.hospital;
                                            toDepartment = receiver.department;
                                            toPhone = receiver.phone;
                                            phone = sender.phone;
                                            cid = record.cid;
                                            encryptedAesKeyForSender = encryptedAesKeyForSender;
                                            encryptedAesKeyForReceiver = encryptedAesKeyForReceiver;
                                            status = "APPROVED";
                                            originalRecordId = ?originalId;
                                            transferredDoctors = Array.append<Text>(record.transferredDoctors, [sender.name]);
                                        };
                                        
                                        records.put(nextId, newRecord);
                                        updateTransferHistoryCache(originalId, nextId);
                                        nextId += 1;

                                        // 원본 기록의 상태를 "TRANSFERRED"로 업데이트
                                        let updatedRecord: MedicalRecord = {
                                            id = record.id;
                                            date = record.date;
                                            patientName = record.patientName;
                                            patientPhone = record.patientPhone;
                                            title = record.title;
                                            description = record.description;
                                            fromDoctor = record.fromDoctor;
                                            fromEmail = record.fromEmail;
                                            fromHospital = record.fromHospital;
                                            fromDepartment = record.fromDepartment;
                                            fromPhone = record.fromPhone;
                                            toDoctor = record.toDoctor;
                                            toEmail = record.toEmail;
                                            toHospital = record.toHospital;
                                            toDepartment = record.toDepartment;
                                            toPhone = record.toPhone;
                                            phone = record.phone;
                                            cid = record.cid;
                                            encryptedAesKeyForSender = record.encryptedAesKeyForSender;
                                            encryptedAesKeyForReceiver = record.encryptedAesKeyForReceiver;
                                            status = "TRANSFERRED";
                                            originalRecordId = record.originalRecordId;
                                            transferredDoctors = record.transferredDoctors;
                                        };
                                        records.put(record.id, updatedRecord);
                                        #ok(newRecord)
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
    };
}; 